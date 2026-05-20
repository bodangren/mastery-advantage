# Knowledge Space + SRS Specification

> **Version:** kst-srs.v2
> **Status:** Living specification — validated against production graph data (english/gse-knowledge-space.json: 2,172 nodes / 28,489 edges) and implemented in ra-math-advantage
> **Scope:** Domain-neutral algorithms, data models, and contracts for any Knowledge Space Theory + Spaced Repetition system

This specification defines the complete KST+SRS system. It is domain-neutral: the same algorithms, schemas, and contracts work for mathematics, English/GSE, science, coding, or any learnable domain with prerequisite structure.

**Normative status:** This document is the single source of truth for the knowledge space data model, validation rules, and system contracts. README.md's schema summary is non-normative and defers to this spec.

**v2 changes:** Reconciled binary KST mastery with continuous SRS retention (hysteresis model); made `weight` a live field via weighted readiness; added edge calibration loop (Beta-Bernoulli posterior); added next-skill planner with composite priority; added placement / cold-start contract; closed the misconception loop (`remediated_by` edge, rating cap, lifecycle); renamed "problem family" → "practice variant"; added `transfers_to` edge, Level Projection, FSRS per-card limitation note; fixed `progressTrend` to real time-delta.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Knowledge State & Mastery](#2-knowledge-state--mastery)
3. [Knowledge Space Data Model](#3-knowledge-space-data-model)
4. [Validation Rules](#4-validation-rules)
5. [Edge Suggestion Engine](#5-edge-suggestion-engine)
6. [Edge Calibration](#6-edge-calibration)
7. [Blueprint Contracts](#7-blueprint-contracts)
8. [Practice Submission Contract](#8-practice-submission-contract-practicev1)
9. [Projection System](#9-projection-system)
10. [Next-Skill Planner](#10-next-skill-planner)
11. [Placement](#11-placement)
12. [SRS Engine](#12-srs-engine)
13. [Proficiency Assessment](#13-proficiency-assessment)
14. [Cross-Course Equivalence](#14-cross-course-equivalence)
15. [Domain Adapter Pattern](#15-domain-adapter-pattern)
16. [Level Projection](#16-level-projection)

Appendices: [A](#appendix-a-implementation-package-map) · [B](#appendix-b-synthetic-fixtures) · [C](#appendix-c-versioning)

---

## 1. Core Concepts

### 1.1 Knowledge Space Theory (KST)

A learning domain is modeled as a **directed, weighted graph** where:

- **Nodes** represent learnable entities (skills, concepts, standards, worked examples, task blueprints, generators, renderers, misconceptions)
- **Edges** represent typed relationships (prerequisites, containment, support, equivalence, alignment, transfer, remediation)
- A learner's **knowledge state** is a time-dependent function returning mastered, decaying, in-progress, and untouched skills (§2)
- The **outer fringe** (readiness set) contains skills the learner is ready to attempt next, ranked by readiness and priority (§2, §10)

### 1.2 Spaced Repetition System (SRS)

Once a skill enters a learner's knowledge state, it is scheduled for review using a spaced repetition algorithm (FSRS — Free Spaced Repetition Scheduler). SRS determines *when* to review; KST determines *what* to learn next.

### 1.3 Projections

The raw knowledge graph is never exposed directly to users. Instead, **projections** transform graph state into role-specific payloads:

| Role | Projection | Purpose |
|------|-----------|---------|
| Student | Activity Map, Visualization, SRS Queue | What to practice, what's next, what to review |
| Parent | Parent Visualization | Plain-language progress summaries |
| Teacher | Teacher Evidence, Teacher Visualization | Class heatmaps, bottleneck analysis, intervention groups |
| System | SRS Inputs, Seed Payloads | Internal runtime artifacts |

### 1.4 Vocabulary

| Term | Definition |
|------|-----------|
| **Node** | A learnable or reference entity in the knowledge graph |
| **Edge** | A typed directed relationship between nodes |
| **Weight** | How necessary a prerequisite is (0–1). 1.0 = hard gate, lower = partially compensable. Consumed by the weighted readiness formula (§2.5). |
| **Confidence** | Evidence confidence for a node or edge. Ordered: `low` < `medium` < `high`. Used for filtering in cycle detection (default excludes `low`) and edge suggestion output. |
| **Provenance** | Source reference explaining where a node or edge came from |
| **Readiness** | Weighted composite score that a learner can productively attempt a node (§2.5) |
| **Blueprint** | Domain-supplied plan for turning a node into practice activities |
| **Projection** | Generated runtime artifact derived from the graph and blueprints |
| **Domain Adapter** | Validation boundary where a specific domain interprets metadata |
| **Practice Variant** | A category of practice problems testing the same underlying skill (domain-supplied granularity). A domain that does not subdivide uses a single variant per objective (`variantKey = objectiveId`). |
| **Card** | An SRS scheduling unit tied to one student × one objective × one practice variant (§12.1) |

---

## 2. Knowledge State & Mastery

The KST half of the system uses a discrete mastery set; the SRS half uses continuous, time-dependent retention. This section reconciles the two models.

### 2.1 Per-Skill Mastery Level

Each skill has a mastery level `m ∈ [0,1]`, derived as follows:

| State | Mastery level `m` |
|-------|-------------------|
| **mastered** | `1.0` |
| **decaying** | live `retention` from `stabilityToRetention(cardStability, elapsedDays)` |
| **inProgress** | objective proficiency `retentionStrength` (practiced but never mastered) |
| **untouched** | `0` |

### 2.2 Mastery with Hysteresis

Hysteresis prevents flapping between states when a learner's retention oscillates near a threshold.

- **Enter mastered:** objective proficiency `isProficient === true` AND live `retention ≥ masteryEnter` (default `0.90`).
- **Exit mastered → decaying:** live `retention < masteryExit` (default `0.70`). By design, `masteryExit < masteryEnter`.
- **Re-enter mastered from decaying:** a successful review pushes `retention ≥ masteryEnter` again (no need to re-establish full proficiency).
- **inProgress → mastered:** same as the enter rule above.
- **untouched → inProgress:** first practice submission with evidence.

### 2.3 Knowledge State Function

The knowledge state is a function of time — it is never stored, always recomputed:

```
getKnowledgeState(student, now) → {
  mastered: Set<string>,     // skills with m = 1.0
  decaying: Map<string, number>,  // skillId → live retention
  inProgress: Map<string, number>, // skillId → retentionStrength
  untouched: Set<string>     // never practiced
}
```

### 2.4 Engine Configuration (Thresholds)

All mastery and readiness thresholds are configurable engine constants, collected here:

```typescript
interface MasteryConfig {
  masteryEnter: number;       // default 0.90 — retention threshold to enter mastered
  masteryExit: number;        // default 0.70 — retention threshold to exit mastered (must be < masteryEnter)
  readyThreshold: number;     // default 0.80 — readiness score to classify as "ready"
  nearThreshold: number;      // default 0.50 — readiness score to classify as "nearly_ready"
}
```

### 2.5 Weighted Readiness

The readiness score for a node `B` is the weighted average of its prerequisites' mastery levels:

```
readiness(B) = Σ(w_i · m_i) / Σ(w_i)   over all prerequisite_for edges i → B
             = 1                        if B has no prerequisites
```

where `w_i` is the edge weight and `m_i` the student's mastery level of prerequisite `i` (§2.1).

Classification:

| Condition | State |
|-----------|-------|
| `readiness(B) ≥ readyThreshold` (default 0.80) | **ready** |
| `readiness(B) ≥ nearThreshold` (default 0.50) | **nearly_ready** |
| otherwise | **blocked** |

### 2.6 Time-Aware Outer Fringe Algorithm

The outer fringe returns the set of skills a learner is ready to attempt next, each with a readiness score.

```
getOuterFringe(student, graph, now):
  state = getKnowledgeState(student, now)
  ready = []
  nearly_ready = []
  for each skill node B not in state.mastered:
    r = readiness(B, state)              // §2.5 weighted formula
    if r ≥ readyThreshold:
      ready.push({ nodeId: B.id, readiness: r })
    else if r ≥ nearThreshold:
      nearly_ready.push({ nodeId: B.id, readiness: r })
  return { ready, nearly_ready }
```

**TypeScript implementation:**

```typescript
interface FringeEntry { nodeId: string; readiness: number; }

function getOuterFringe(
  student: StudentContext,
  graph: { nodes: KnowledgeSpaceNode[]; edges: KnowledgeSpaceEdge[] },
  now: Date,
  config: MasteryConfig
): { ready: FringeEntry[]; nearly_ready: FringeEntry[] } {
  const state = getKnowledgeState(student, now);
  const prereqEdges = graph.edges.filter(e => e.type === 'prerequisite_for');
  const prereqsFor = new Map<string, Array<{ sourceId: string; weight: number }>>();
  for (const edge of prereqEdges) {
    if (!prereqsFor.has(edge.targetId)) prereqsFor.set(edge.targetId, []);
    prereqsFor.get(edge.targetId)!.push({ sourceId: edge.sourceId, weight: edge.weight });
  }

  const ready: FringeEntry[] = [];
  const nearly_ready: FringeEntry[] = [];

  for (const node of graph.nodes.filter(n => n.kind === 'skill')) {
    if (state.mastered.has(node.id)) continue;
    const prereqs = prereqsFor.get(node.id);
    const r = prereqs && prereqs.length > 0
      ? prereqs.reduce((sum, p) => sum + p.weight * getMasteryLevel(p.sourceId, state), 0)
        / prereqs.reduce((sum, p) => sum + p.weight, 0)
      : 1.0;
    if (r >= config.readyThreshold) ready.push({ nodeId: node.id, readiness: r });
    else if (r >= config.nearThreshold) nearly_ready.push({ nodeId: node.id, readiness: r });
  }
  return { ready, nearly_ready };
}

function getMasteryLevel(nodeId: string, state: KnowledgeState): number {
  if (state.mastered.has(nodeId)) return 1.0;
  if (state.decaying.has(nodeId)) return state.decaying.get(nodeId)!;
  if (state.inProgress.has(nodeId)) return state.inProgress.get(nodeId)!;
  return 0;
}
```

### 2.7 Decay Propagation

When a prerequisite is `decaying` or below `masteryExit`, downstream skills that depend on it carry a `readinessRisk` flag. Downstream skills are **not** auto-evicted from the mastered set — the risk is surfaced in projections instead:

- **Student view:** "review urgent" badge on the decaying prerequisite.
- **Teacher view:** `prerequisiteGaps` includes the at-risk downstream skills.

---

## 3. Knowledge Space Data Model

### 3.1 Node Kinds

```
NodeKind =
  | 'domain'              // Top-level domain container (e.g. "Integrated Math 3")
  | 'content_group'       // Module or unit grouping (e.g. "Module 1: Quadratics")
  | 'instructional_unit'  // Lesson or session (e.g. "Lesson 1.2: Solving by Factoring")
  | 'standard'            // External standard/objective (e.g. "CCSS.HSA.REI.B.4.B")
  | 'skill'               // Discrete learnable skill
  | 'concept'             // Conceptual understanding node
  | 'worked_example'      // Demonstrated solution
  | 'task_blueprint'      // Practice task definition
  | 'generator'           // Deterministic content generator
  | 'renderer'            // Visual/interactive rendering component
  | 'misconception'       // Common learner misconception
```

### 3.2 Edge Types

```
EdgeType =
  | 'contains'                    // Hierarchical containment (domain → module → lesson → skill)
  | 'appears_in_context'          // Node is contextually relevant to a unit/lesson
  | 'aligned_to_standard'         // Skill/task maps to an external standard
  | 'prerequisite_for'            // Source must be mastered before target is accessible
  | 'supports'                    // Source helps with target but is not required
  | 'extends'                     // Source extends or deepens target
  | 'equivalent_to'               // Nodes represent the same skill across courses/domains (identity)
  | 'transfers_to'                // Mastery of source transfers partially to target (cross-domain, weighted)
  | 'common_misconception_with'   // Misconception relates to a skill/concept
  | 'remediated_by'               // Misconception is remediated by a worked example, task blueprint, or skill
  | 'rendered_by'                 // Node is rendered by a specific renderer
  | 'generated_by'                // Node's content is produced by a generator
  | 'evidenced_by'                // Node mastery is evidenced by an assessment type (reserved — no consumer defined yet)
```

### 3.3 Node Schema

```typescript
interface KnowledgeSpaceNode {
  id: string;                    // Dot-separated lower-kebab-case, e.g. "math.im3.skill.m1.l2.solve-quadratic"
  kind: NodeKind;
  title: string;
  domain: string;                // Domain identifier, e.g. "math.im3", "english.gse"
  description?: string;
  sourceRefs?: Array<SourceRef | string>;  // Required unless derived:true
  derived?: boolean;             // True if node was algorithmically derived
  derivationMethod?: string;     // Method name if derived
  reviewStatus: 'draft' | 'reviewed' | 'approved' | 'rejected';
  metadata: Record<string, unknown>;  // Domain-specific metadata
  difficulty?: number;           // 0–1 normalized difficulty
  alignmentRefs?: string[];      // References to alignment sources
  rendererKey?: string;          // Preferred renderer for this node
  generatorKey?: string;         // Generator that produces content for this node
  independentPracticeReady?: boolean;  // Ready for independent practice
  exceptions?: Exception[];      // Documented exceptions to validation rules
}

interface SourceRef {
  source: string;                // Source identifier
  location?: string;             // Location within source
  url?: string;
  note?: string;
}

interface Exception {
  type: 'alignment' | 'generator' | 'source' | 'other';
  reason: string;
  reviewer?: string;
  date?: string;
}
```

### 3.4 Edge Schema

```typescript
interface KnowledgeSpaceEdge {
  id: string;                    // Dot-separated lower-kebab-case
  type: EdgeType;
  sourceId: string;              // Must reference an existing node ID
  targetId: string;              // Must reference an existing node ID
  weight: number;                // 0–1 relationship strength (consumed by weighted readiness, §2.5)
  confidence: 'low' | 'medium' | 'high';
  sourceRefs?: Array<SourceRef | string>;  // Required unless derived:true
  derived?: boolean;
  derivationMethod?: string;
  reviewStatus: 'draft' | 'reviewed' | 'approved' | 'rejected';
  rationale?: string;            // Human-readable explanation
  metadata?: Record<string, unknown>;
}
```

### 3.5 Knowledge Space Document

```typescript
interface KnowledgeSpace {
  nodes: KnowledgeSpaceNode[];   // Non-empty array
  edges: KnowledgeSpaceEdge[];   // May be empty (edges are optional)
}
```

### 3.6 ID Convention

Node and edge IDs follow the pattern:

```
^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$
```

- Dot-separated segments
- Each segment is lower-kebab-case
- First segment must start with a letter
- Minimum two segments
- Examples: `math.im3.skill.m1.l2.solve-quadratic`, `english.gse.skill.b1.reading.main-idea`

### 3.7 Edge Endpoint Pairing Rules

Certain edge types require specific node kinds at their endpoints. Only 6 of 13 edge types have pairing rules; the remaining 7 (`prerequisite_for`, `supports`, `extends`, `equivalent_to`, `transfers_to`, `appears_in_context`, `evidenced_by`) accept any node kind at both endpoints. This is intentional: prerequisite relationships, for example, can exist between any two learnable entities regardless of kind.

| Edge Type | Source Kinds | Target Kinds |
|-----------|-------------|--------------|
| `rendered_by` | `skill`, `worked_example`, `task_blueprint`, `concept` | `renderer` |
| `generated_by` | `skill`, `task_blueprint`, `concept` | `generator` |
| `aligned_to_standard` | `skill`, `worked_example`, `task_blueprint`, `concept` | `standard` |
| `common_misconception_with` | any | `misconception` |
| `remediated_by` | `misconception` | `worked_example`, `task_blueprint`, `skill` |
| `contains` | `domain`, `content_group`, `instructional_unit` | `content_group`, `instructional_unit`, `worked_example`, `skill`, `concept`, `task_blueprint` |

---

## 4. Validation Rules

A knowledge space must pass all validation checks before being accepted into the system.

### 4.1 Structural Checks

| Check | Code | Description |
|-------|------|-------------|
| Duplicate Node IDs | `DUPLICATE_NODE_ID` | Every node ID must be unique |
| Dangling Edges | `DANGLING_EDGE` | Every edge sourceId and targetId must reference existing nodes |
| Duplicate Edges | `DUPLICATE_EDGE` | No two edges may have the same (sourceId, targetId, type) triple |
| Endpoint Pairing | `INVALID_EDGE_PAIRING` | Edge types must connect allowed node kinds |

### 4.2 Content Checks

| Check | Code | Description |
|-------|------|-------------|
| Missing Alignment | `MISSING_REQUIRED_ALIGNMENT` | Nodes of kind `skill`, `worked_example`, or `task_blueprint` must have an `aligned_to_standard` edge (or documented `alignment` exception) |
| Missing Generator | `MISSING_GENERATOR` | Nodes with `independentPracticeReady: true` must have a `generated_by` edge (or documented `generator` exception) |
| Prerequisite Cycles | `PREREQUISITE_CYCLE` | No cycles in high/medium-confidence `prerequisite_for` edges |

### 4.3 Cycle Detection Algorithm

```
function getPrerequisiteCycles(graph, options?):
  1. Build adjacency list from prerequisite_for edges
     - Include edges with confidence >= threshold
     - Default: exclude 'low' confidence edges
  2. Run DFS with recursion stack tracking
  3. When a back-edge is found (node in recursion stack):
     - Extract cycle path from stack
     - Record cycle nodes and edge IDs
  4. Return all detected cycles
```

### 4.4 Provenance Requirement

Every node and edge must have at least one `sourceRef` citing its origin. Derived edges (produced by the edge suggestion engine, §5) cite their derivation method as a string sourceRef, e.g. `sourceRefs: ["lesson-sequence-prerequisite-v1"]`. The `derived` boolean and `derivationMethod` fields are available for future use but are not required when a string sourceRef identifies the derivation method.

This ensures every element in the graph is traceable.

---

## 5. Edge Suggestion Engine

The edge suggestion engine derives candidate edges from node inventories using metadata patterns. All suggestions cite their derivation method in `sourceRefs` (e.g. `["lesson-sequence-containment-v1"]`) with `confidence: low` or `medium` and require human review.

### 5.1 Containment Edges (`contains`)

**Method:** `lesson-sequence-containment-v1`

Derives hierarchical containment from metadata fields:

```
domain → content_group    (weight: 1.0, confidence: high)
content_group → instructional_unit  (weight: 1.0, confidence: high)
instructional_unit → skill  (weight: 1.0, confidence: high)
instructional_unit → worked_example  (weight: 1.0, confidence: high)
content_group → concept  (weight: 1.0, confidence: high)
```

Grouping keys: `metadata.module`, `metadata.lesson`

### 5.2 Placement Edges (`appears_in_context`)

**Method:** `lesson-sequence-placement-v1`

Links skills, concepts, and worked examples to their contextual containers:

```
skill → instructional_unit  (weight: 0.75, confidence: medium)
concept → content_group  (weight: 0.75, confidence: medium)
worked_example → instructional_unit  (weight: 0.75, confidence: medium)
```

### 5.3 Prerequisite Edges (`prerequisite_for`)

**Method:** `lesson-sequence-prerequisite-v1`

Creates sequential prerequisite chains between consecutive lessons:

```
last skill of lesson N → first skill of lesson N+1  (weight: 0.5, confidence: low)
```

This produces a low-confidence sequential backbone that can be refined by domain experts and validated by the edge calibration loop (§6).

### 5.4 Support Edges (`supports`)

**Method:** `concept-supports-skill-v1`

Links concepts to skills within the same module:

```
concept → skill (same module)  (weight: 0.75, confidence: medium)
```

### 5.5 Equivalence Edges (`equivalent_to`)

**Method:** `intra-course-equivalence-v1`

Identifies concepts sharing the same `familyKey` within a course:

```
concept A ↔ concept B (same familyKey)  (weight: 0.5, confidence: low)
```

### 5.6 Output

All suggested edges are:
1. Deduplicated by (type, sourceId, targetId)
2. Sorted deterministically: type → sourceId → targetId
3. Assigned sequential IDs: `{prefix}.edge.{NNNN}`

---

## 6. Edge Calibration

Prerequisite edges derived from lesson sequence (§5.3) are not the same as true prerequisite structure. The edge calibration loop validates edges against learner outcomes and produces a human review queue — the graph is never auto-edited.

### 6.1 Observation Unit

An observation is a pair of objective-proficiency verdicts for one student on `(A, B)` where the student has a verdict on both. Proficiency verdicts are used, not single attempts (too noisy).

### 6.2 Contingency Table

Per `prerequisite_for` edge `A → B`:

```
             proficient B   not proficient B
proficient A      a               b
not proficient A  c  ← violations d
```

### 6.3 Statistics

**Necessity** = `1 − P(proficient B | not proficient A)` = `1 − c/(c+d)`. A true hard prerequisite → necessity ≈ 1 (cell `c` ≈ 0).

**Informativeness (lift)** = `P(proficient B | proficient A) − P(proficient B | not proficient A)`. Guards against trivial edges (a skill nearly everyone passes will have low informativeness even with low violations).

### 6.4 Bayesian Incremental Update

Model each edge's necessity as a Beta-Bernoulli posterior `Beta(α, β)`:

- Each consistent observation (student proficient in A and B, or not proficient in A and not proficient in B) increments `α`.
- Each violation (not proficient in A but proficient in B) increments `β`.
- `weight ← posterior mean = α / (α + β)`.
- `confidence ← bucketed from posterior variance / sample size`.

**Recency decay:** Periodically multiply `α, β` by `λ < 1` (e.g. `λ = 0.95` per cohort) so the edge tracks recent cohorts.

### 6.5 Confounding Guardrail

Absence of violations can be an artifact of curriculum sequencing: if no student ever attempts `B` before `A`, cell `c` is structurally empty and necessity is *unmeasured*, not *confirmed*. Define a third edge calibration status:

| Status | Meaning |
|--------|---------|
| `confirmed` | Sufficient observations, high necessity, high informativeness |
| `refuted` | Sufficient observations, low necessity or low informativeness |
| `untested` | Insufficient natural order-variation (adaptive placement, §11, is the primary source of clean signal) |

### 6.6 Output: Human Review Queue

Edges whose calibrated posterior diverges from the authored `weight`/`confidence` beyond a threshold are flagged for human review with their contingency table attached. This reuses the existing `reviewStatus` machinery. The graph is never auto-edited.

---

## 7. Blueprint Contracts

Blueprints define how a knowledge space node becomes learner-facing practice. Each blueprint is tied to one node and may contain specs for multiple practice modes.

### 7.1 Knowledge Blueprint

```typescript
interface KnowledgeBlueprint {
  id: string;                  // Stable blueprint ID, e.g. "{nodeId}.blueprint"
  nodeId: string;              // The knowledge space node this blueprint serves
  sourceNodeIds: string[];     // Prerequisite/supporting node IDs
  alignmentNodeIds: string[];  // Standard alignment node IDs
  rendererKey: string;         // Primary renderer for this blueprint
  rendererModeMap: Record<string, string>;  // Mode-specific renderer overrides
  workedExampleSpec?: WorkedExampleSpec;
  guidedPracticeSpec?: GuidedPracticeSpec;
  independentPracticeSpec?: IndependentPracticeSpec;
  generatorKey?: string;       // Key for deterministic content generator
  gradingSpec?: GradingSpec;   // Grading configuration
  misconceptionTags?: string[];  // Tags for common misconceptions
  reviewStatus: ReviewStatus;
  metadata: Record<string, unknown>;
}
```

### 7.2 Worked Example Spec

```typescript
interface WorkedExampleSpec {
  prompt: string;              // The problem statement
  givens: string[];            // Known values or conditions
  target: Record<string, unknown>;  // Expected result
  steps: WorkedStep[];         // Solution steps
  explanation: string;         // Narrative explanation
  visualArtifact?: Record<string, unknown>;  // Optional visual component
}

interface WorkedStep {
  description: string;         // What this step does
  expression?: string;         // Mathematical expression or code
  result?: string;             // Result of this step
  explanation?: string;        // Why this step works
}
```

### 7.3 Guided Practice Spec

```typescript
interface GuidedPracticeSpec {
  scaffoldedPrompt: string;    // The problem with scaffolding
  stepPrompts: string[];       // Per-step guidance prompts
  hints: string[];             // Available hints
  checksPerStep: Array<{
    check: string;             // What to verify
    answerPattern?: string;    // Expected answer pattern
  }>;
  revealPolicy: 'all_at_once' | 'one_at_a_time' | 'after_attempt';
}
```

### 7.4 Independent Practice Spec

```typescript
interface IndependentPracticeSpec {
  variantParameters: Record<string, VariantParameter>;  // Parameters for variation
  generatorInputConstraints?: Record<string, unknown>;
  answerSchema: Record<string, unknown>;  // Expected answer structure
  gradingRules: GradingRule[];
  replayPolicy: 'any_seed' | 'unique_seeds' | 'uniq_seeds_per_learner';
}

interface VariantParameter {
  type: 'number' | 'integer' | 'string' | 'boolean' | 'enum';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description?: string;
}

interface GradingRule {
  partId: string;
  ruleType: 'exact_match' | 'numeric_tolerance' | 'expression_equivalence' | 'custom';
  tolerance?: number;
  maxScore: number;
}
```

### 7.5 Generator Interface

```typescript
interface GeneratorInput {
  nodeId: string;
  seed: number;                // Deterministic seed for reproducibility
  difficulty: number;          // 0–1 difficulty
  learnerContext?: Record<string, unknown>;
}

interface GeneratorOutput {
  prompt: string;
  data: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  solutionSteps: Array<{
    description: string;
    expression?: string;
    value?: unknown;
  }>;
  gradingMetadata: GradingMetadata;
}

interface GradingMetadata {
  partAnswers: Record<string, unknown>;
  partMaxScores: Record<string, number>;
  partGradingRules: Record<string, 'exact_match' | 'numeric_tolerance' | 'expression_equivalence'>;
  partTolerances?: Record<string, number>;
}

interface DeterministicGenerator {
  generate(input: GeneratorInput): GeneratorOutput;
}
```

### 7.6 Grading Spec

```typescript
interface GradingSpec {
  partIds: string[];           // Identifiers for gradable parts
  passingScore?: number;       // Minimum score to pass
  partialCredit: boolean;      // Whether partial credit is allowed
  rubric?: Array<{
    criteria: string;
    points: number;
    partId?: string;
  }>;
}
```

### 7.7 Shared Type Definitions

Types referenced across sections but defined here to avoid duplication:

```typescript
// From §3 (data model)
type ReviewStatus = 'draft' | 'reviewed' | 'approved' | 'rejected';
type ConfidenceLevel = 'low' | 'medium' | 'high';  // Ordered: low < medium < high

// From §12 (SRS)
type ObjectivePriority = 'essential' | 'supporting' | 'extension' | 'triaged';

// From §9 (projections)
interface VisualNodeV1 {
  nodeId: string;
  title: string;
  description?: string;
  state: 'mastered' | 'ready' | 'blocked' | 'review_due' | 'unknown';
  difficulty?: number;
  domain?: string;
}

interface VisualEdgeV1 {
  sourceId: string;
  targetId: string;
  type: 'prerequisite' | 'supports' | 'extends';
  weight: number;
}

interface TeacherHeatmapCell {
  nodeId: string;
  title: string;
  masteredCount: number;
  totalCount: number;
  proficiencyRate: number;
}

interface InterventionGroup {
  groupId: string;
  label: string;
  nodeIds: string[];
  studentCount: number;
}

interface AttemptArtifact {
  nodeId: string;
  partIds: string[];
  submissionProvenance: string;
}

// From §13 (proficiency)
interface PracticeVariantDetail {
  variantKey: string;
  retentionStrength: number;
  practiceCoverage: number;
  fluencyConfidence: EvidenceConfidence;
  baselineSampleCount: number;
  missingBaseline: boolean;
}

interface ProficiencyCardInput {
  cardId: string;
  variantKey: string;
  reps: number;
  lapses: number;
  stability: number;
  lastReview: string | null;
}

interface TimingBaselines {
  [variantKey: string]: {
    sampleCount: number;
    meanMs: number;
    stdDevMs: number;
  };
}

// From §6 (edge calibration)
type EdgeCalibrationStatus = 'confirmed' | 'refuted' | 'untested';

// From §11 (placement)
interface PlacementResult {
  nodeId: string;
  masteryEstimate: number;
  confidence: ConfidenceLevel;
}
```

---

## 8. Practice Submission Contract (practice.v1)

The practice submission contract defines the shape of learner activity submissions that feed into the SRS review pipeline (§12.6) and proficiency assessment (§13).

### 8.1 Submission Envelope

```typescript
interface PracticeSubmissionEnvelope {
  activityId: string;            // Stable activity identifier
  attemptNumber: number;         // Sequential attempt count for this activity
  studentId: string;
  submittedAt: string;           // ISO timestamp
  parts: PracticeSubmissionPart[];
  timing?: PracticeTimingSummary;
}
```

### 8.2 Submission Part

```typescript
interface PracticeSubmissionPart {
  partId: string;                // Identifier for the gradable part
  rawAnswer: unknown;            // Learner's raw answer
  isCorrect: boolean;            // Graded correctness
  score: number;                 // Earned score
  maxScore: number;              // Maximum possible score
  hintsUsed: number;             // Number of hints consumed
  revealStepsSeen: number;       // Number of worked steps revealed (guided mode)
  misconceptionTags?: string[];  // Tags for detected misconceptions
}
```

### 8.3 Timing Summary

```typescript
interface PracticeTimingSummary {
  totalMs: number;               // Total time spent on the activity
  idleMs: number;                // Time classified as idle (above idle threshold)
  activeMs: number;              // totalMs - idleMs
  perPartMs: Record<string, number>;  // Time per part
  confidence: 'low' | 'medium' | 'high';  // Reliability of timing data
}
```

### 8.4 SRS Rating Computation

Submissions are converted to SRS ratings through a two-stage process:

1. **Base rating** from correctness across parts:
   - All correct → `Good` or `Easy` (depends on hint usage)
   - Partially correct → `Hard`
   - All incorrect → `Again`

2. **Timing adjustment** (if timing baseline exists):
   - Significantly faster than baseline → may upgrade rating
   - Significantly slower than baseline → may downgrade rating
   - No baseline → rating is based on correctness only

3. **Misconception cap** (§6): a submission that is correct but exhibits a misconception cannot map to `Easy`; cap at `Hard`, or `Again` if the misconception is severe. `misconceptionTags` is already in the review-log evidence — the mapper can see it.

```typescript
interface SrsRatingResult {
  rating: SrsRating;             // Final rating applied to card
  baseRating: SrsRating;         // Rating from correctness alone
  timingAdjusted: boolean;       // Whether timing changed the rating
  misconceptionCapped: boolean;  // Whether misconception capped the rating
  reasons: string[];             // Diagnostic reasons for the rating
}
```

---

## 9. Projection System

Projections transform the knowledge graph and blueprints into runtime artifacts. Projections are **regenerated outputs** — they are not source truth.

### 9.1 Activity Map Projection

Maps knowledge space nodes, edges, and blueprints into practice activity rows.

**Input:**
- `nodes: KnowledgeSpaceNode[]`
- `edges: KnowledgeSpaceEdge[]`
- `blueprints: KnowledgeBlueprint[]`

**Output:** `ProjectedActivity[]`

```typescript
interface ProjectedActivity {
  stableActivityId: string;    // "{nodeId}.{mode}"
  nodeId: string;
  sourceNodeIds: string[];     // Enriched from prerequisite/supports/extends edges
  rendererKey: string;
  mode: 'worked_example' | 'guided_practice' | 'independent_practice' | 'assessment';
  alignmentNodeIds: string[];  // Enriched from aligned_to_standard edges
  props: Record<string, unknown>;  // Mode-specific spec properties
  gradingConfig: Record<string, unknown>;
  srsEligible: boolean;        // True if independentPracticeSpec or generatorKey present
}
```

**Algorithm:**
1. For each blueprint, enrich `sourceNodeIds` from edges targeting `nodeId`
2. Enrich `alignmentNodeIds` from `aligned_to_standard` edges
3. Emit one row per available spec (worked, guided, independent)
4. Sort by `nodeId` then mode order: worked → guided → independent → assessment

### 9.2 SRS Input Projection

Maps skill and task-blueprint nodes to SRS card targets.

**Input:**
- `nodes: KnowledgeSpaceNode[]`
- `edges: KnowledgeSpaceEdge[]`
- `blueprints: KnowledgeBlueprint[]`

**Output:** `SrsProjectionEntry[]`

```typescript
interface SrsProjectionEntry {
  nodeId: string;
  blueprintId: string;
  standards: string[];         // From aligned_to_standard edges + blueprint alignment
  prerequisites: string[];     // From prerequisite_for edges targeting this node
  difficulty: number;          // node.difficulty or blueprint metadata or 0.5 default
  generatorKey?: string;
  generatorReady: boolean;
  equivalentNodeIds: string[]; // From equivalent_to edges
}
```

**Algorithm:**
1. Filter nodes to `skill` and `task_blueprint` kinds
2. For each node, collect standards from `aligned_to_standard` edges
3. Collect prerequisites from `prerequisite_for` edges targeting the node
4. Determine generator readiness from `independentPracticeReady`, spec presence, or generator key
5. Collect equivalent nodes from `equivalent_to` edges

### 9.3 Teacher Evidence Projection

Generates teacher-facing evidence from the graph.

**Input:**
- `nodes: KnowledgeSpaceNode[]`
- `edges: KnowledgeSpaceEdge[]`
- `classStats: Record<nodeId, { mastered: number; total: number }>` (optional)

**Output:** `TeacherEvidence`

```typescript
interface TeacherEvidence {
  standards: StandardCoverage[];      // Per-standard activity counts
  skills: SkillCoverage[];            // Per-skill alignment and readiness
  prerequisiteGaps: PrerequisiteGap[];  // Skills with unmet prerequisites
  attemptArtifacts: AttemptArtifact[];  // Worked example submission references
  equivalenceComponents: EquivalenceComponentSummary[];  // Cross-course equivalence groups
  activeMisconceptionCount: number;   // Count of active misconceptions across class
}

interface StandardCoverage {
  standardId: string;
  standardTitle: string;
  nodeIds: string[];
  workedExampleCount: number;
  guidedPracticeCount: number;
  independentPracticeCount: number;
}

interface SkillCoverage {
  nodeId: string;
  title: string;
  kind: string;
  standardsCovered: string[];
  prerequisitesMet: boolean;
  independentPracticeReady: boolean;
  equivalentNodeIds: string[];
}

interface PrerequisiteGap {
  nodeId: string;
  title: string;
  missingPrerequisites: string[];
  blockingLevel: 'full' | 'partial';  // full: proficiency < 0.3, partial: < 0.6
}
```

### 9.4 Visualization Projections

Three role-specific visualization projections, each producing a schema-validated payload.

#### Student Visualization

```typescript
interface StudentVisualizationV1 {
  schemaVersion: 'v1';
  mastered: VisualNodeV1[];
  ready: VisualNodeV1[];
  blocked: VisualNodeV1[];
  reviewDue: VisualNodeV1[];
  recommendedNext: VisualNodeV1[];  // Top-N by priority score (§10)
  edges: VisualEdgeV1[];
}
```

**Node state computation** (uses weighted readiness, §2.5):
1. If `learnerState[nodeId]` exists with mastery level, use it
2. If node is in `masteredIds`, state is `mastered`
3. Compute `readiness(nodeId)` from weighted prerequisites (§2.5)
4. If `readiness < nearThreshold`, state is `blocked`
5. If `readiness >= readyThreshold`, state is `ready`
6. Otherwise, state is `unknown`

#### Parent Visualization

```typescript
interface ParentVisualizationV1 {
  schemaVersion: 'v1';
  canDoSummary: string;           // "Can [mastered skills list]"
  nextFocus: string;              // "Practice: [first recommended]"
  blockers: string[];             // Titles of blocked nodes
  progressTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  nodes: VisualNodeV1[];
}
```

**Progress trend** (real time-delta of mastered-count over a window):
- Compare mastered count at `now` vs `now - window` (default window: 14 days).
- `improving`: mastered count increased by more than a threshold (e.g. +3 skills).
- `stable`: mastered count changed within the threshold.
- `declining`: mastered count decreased (skills left mastered set due to decay).
- `unknown`: insufficient history (fewer than 2 data points in the window).

#### Teacher Visualization

```typescript
interface TeacherVisualizationV1 {
  schemaVersion: 'v1';
  heatmap: TeacherHeatmapCell[];
  bottleneckNodes: VisualNodeV1[];  // 3 lowest-proficiency nodes
  prerequisiteGaps: PrerequisiteGap[];
  misconceptionClusters: Array<{ label: string; relatedNodeIds: string[] }>;
  interventionGroups: InterventionGroup[];
  standardsCoverage: Array<{ standardId: string; title: string; proficiencyRate: number }>;
  activeMisconceptionCount: number;
}
```

---

## 10. Next-Skill Planner

The outer fringe (§2.6) returns a set — for large graphs it can be dozens wide. The next-skill planner ranks the fringe by composite priority so `recommendedNext` is meaningful.

### 10.1 Priority Score

```
priority(B) = a·readiness(B)
            + b·unlockValue(B)
            + c·goalProximity(B)
            + d·weaknessFit(B)
```

| Term | Definition |
|------|-----------|
| `readiness(B)` | Weighted readiness from §2.5 |
| `unlockValue(B)` | Count (optionally weight-discounted) of skills reachable downstream from `B` via `prerequisite_for` edges. Graph-structural; precomputable. |
| `goalProximity(B)` | Inverse graph distance from `B` to the learner's goal node(s), if a goal is set; otherwise 0. |
| `weaknessFit(B)` | Boost if `B` is linked (via `supports` / `common_misconception_with`) to a recently-failed area or an active misconception (§11). |
| `a, b, c, d` | Configurable engine weights (default: `a=0.4, b=0.3, c=0.2, d=0.1`). |

### 10.2 recommendedNext

`recommendedNext` in the student visualization (§9.4) is the top-N skills from the ready / nearly-ready set ranked by `priority(B)`, replacing the previous "first 5 ready nodes" rule.

---

## 11. Placement

A new student has an empty mastered set, so the whole bottom of the graph is "ready" and nothing above. Placement seeds the initial knowledge state.

### 11.1 Output

An initial knowledge state — a set of `{ nodeId, masteryEstimate, confidence }` — that seeds `getKnowledgeState` (§2.3).

### 11.2 Algorithm: Adaptive Tree Walk

1. Start at a mid-level node (domain-supplied entry point).
2. Probe the node (§11.3).
3. On **pass**: move toward more advanced skills (downstream in the prerequisite direction).
4. On **fail**: move toward prerequisites (upstream).
5. On **partial**: record partial mastery and probe siblings.
6. Converge on the mastery frontier in roughly `O(log n)` probes rather than testing everything.
7. Placement results enter the graph as low-to-medium-confidence mastery estimates and are refined by subsequent practice. They are also a key source of edge-calibration order-variation (§6).

### 11.3 Probe Interface

Abstract; domains implement it.

```typescript
type ProbeResult = 'pass' | 'fail' | 'partial';

interface PlacementProbe {
  probe(nodeId: string): Promise<ProbeResult>;
}
```

Two reference implementations:

| Domain | Implementation |
|--------|---------------|
| **GSE** | A chatbot that walks the tree conversationally, one probe per turn. |
| **Math** | A fixed bank of 20–30 problems, same traversal logic. |

---

## 12. SRS Engine

The SRS engine uses FSRS (Free Spaced Repetition Scheduler) for card scheduling.

### 12.1 Card State

```typescript
interface SrsCardState {
  cardId: string;
  studentId: string;
  objectiveId: string;           // Maps to a knowledge space node ID
  variantKey: string;            // Practice variant within the objective (domain-supplied; defaults to objectiveId)
  stability: number;             // FSRS memory stability
  difficulty: number;            // FSRS item difficulty (0 is a sentinel, not an FSRS default; FSRS difficulty is 1–10)
  state: 'new' | 'learning' | 'review' | 'relearning';
  dueDate: string;               // ISO timestamp
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: string | null;     // ISO timestamp
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}
```

### 12.2 Review Rating

```typescript
type SrsRating = 'Again' | 'Hard' | 'Good' | 'Easy';
```

### 12.3 Scheduler Configuration

```typescript
interface SchedulerConfig {
  requestRetention: number;      // Target retention probability (default: 0.9)
  maximumInterval: number;       // Maximum interval in days (default: 365)
  enableShortTermPreview: boolean;  // Enable short-term preview (default: false)
  siblingReinforcement?: boolean;   // Optional: successful review applies partial stability bump to sibling variant cards under same objective (future)
}
```

### 12.4 Core Scheduler Operations

| Operation | Input | Output | Description |
|-----------|-------|--------|-------------|
| `createCard` | studentId, objectiveId, variantKey | SrsCardState | Initialize a new card with FSRS defaults (stability=0, difficulty=0 as sentinel, state='new') |
| `reviewCard` | card, rating, now | SrsCardState | Apply a rating and return updated card state via FSRS |
| `getDueCards` | cards[], now | SrsCardState[] | Filter cards where dueDate <= now |
| `previewInterval` | card, rating, now | number (days) | Preview scheduled interval without mutating state |

### 12.5 Review Log

```typescript
interface SrsReviewLogEntry {
  reviewId: string;
  cardId: string;
  studentId: string;
  rating: SrsRating;
  submissionId: string;
  evidence:
    | { action: 'teacher_reset'; objectiveId: string }
    | {
        baseRating: SrsRating;
        timingAdjusted: boolean;
        misconceptionCapped: boolean;
        reasons: string[];
        misconceptionTags?: string[];
      };
  stateBefore: { stability; difficulty; state; reps; lapses };
  stateAfter: { stability; difficulty; state; reps; lapses };
  reviewedAt: string;  // ISO timestamp
}
```

### 12.6 Review Processing Pipeline

```
Practice Submission
       │
       ▼
┌─────────────────────┐
│  Extract Parts      │  ← submission.parts[]
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Timing Features    │  ← deriveTimingFeatures(timing, baseline)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Compute SRS Rating │  ← mapPracticeToSrsRating(parts, timingFeatures, misconceptionTags)
│                     │  ← misconception cap: correct + misconception → max "Hard"
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Apply to Card      │  ← reviewCard(card, rating, now)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Build Review Log   │  ← immutable audit entry with before/after state
└─────────────────────┘
```

### 12.7 Daily Queue Builder

**Input:**
- `cards: SrsCardState[]`
- `policies: Map<objectiveId, ObjectivePracticePolicy>`
- `config: SrsSessionConfig`
- `now: string` (ISO timestamp)

**Output:** `QueueItem[]` (ordered)

**Queue ordering rules:**
1. Exclude cards for `triaged` objectives
2. New cards first, ordered by objective priority: `essential` → `supporting` → `extension`
3. Overdue review cards, sorted by days overdue descending
4. Due review cards, sorted by due date ascending
5. Active-misconception remediation items injected ahead of normal progression (§13.3)
6. Cap total at `maxReviewsPerDay`

```typescript
interface SrsSessionConfig {
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  prioritizeOverdue: boolean;
}

interface ObjectivePracticePolicy {
  objectiveId: string;
  priority: 'essential' | 'supporting' | 'extension' | 'triaged';
  minVariants?: number;          // formerly minProblemFamilies
  minCoverageThreshold?: number;
  minRetentionThreshold?: number;
}
```

### 12.8 Card Store and Review Log Store Adapters

```typescript
interface CardStore {
  getCard(cardId: string): Promise<SrsCardState | null>;
  getCardsForStudent(studentId: string): Promise<SrsCardState[]>;
  getCardsForObjective(studentId: string, objectiveId: string): Promise<SrsCardState[]>;
  upsertCard(card: SrsCardState): Promise<void>;
  deleteCard(cardId: string): Promise<void>;
}

interface ReviewLogStore {
  appendLog(entry: SrsReviewLogEntry): Promise<void>;
  getLogsForCard(cardId: string): Promise<SrsReviewLogEntry[]>;
  getLogsForStudent(studentId: string): Promise<SrsReviewLogEntry[]>;
  getLogsForObjective(studentId: string, objectiveId: string): Promise<SrsReviewLogEntry[]>;
}
```

### 12.9 FSRS Per-Card Limitation

FSRS schedules each variant card independently even though sibling variants under one objective are correlated. This is a known, accepted limitation. The optional `siblingReinforcement` config flag (§12.3) — when implemented — applies a partial stability bump to sibling variant cards under the same objective on a successful review.

---

## 13. Proficiency Assessment

Proficiency assessment combines retention strength, practice coverage, and fluency to determine whether a learner has demonstrated proficiency at the objective level.

### 13.1 Practice Variant Evidence

```typescript
interface PracticeVariantEvidence {
  variantKey: string;
  retentionStrength: number;       // 0–1 correctness rate
  practiceCoverage: number;        // 0–1 breadth of problem types practiced
  fluencyConfidence: EvidenceConfidence;
  baselineSampleCount: number;
  timingReliable: boolean;
}

type EvidenceConfidence = 'none' | 'low' | 'medium' | 'high';
```

### 13.2 Objective Proficiency Computation

**Input:**
```typescript
interface ObjectiveProficiencyInput {
  objectiveId: string;
  priority: ObjectivePriority;
  variantEvidences: PracticeVariantEvidence[];
  minVariants?: number;
  minCoverageThreshold?: number;
  minRetentionThreshold?: number;
}
```

**Threshold defaults by priority:**

| Priority | Min Variants | Min Coverage | Min Retention |
|----------|-------------|--------------|---------------|
| essential | 3 | 0.7 | 0.8 |
| supporting | 2 | 0.5 | 0.7 |
| extension | 1 | 0.3 | 0.6 |
| triaged | 0 | 0 | 0 |

**Algorithm:**
1. If priority is `triaged`, mark as non-proficient with reason `objective_triaged`
2. If no evidence, return non-proficient with all zeros
3. Compute average retention and coverage across all practice variants
4. Combine fluency confidences (highest among reliable variants)
5. Resolve evidence confidence based on retention, coverage, and variant count
6. Proficient if: not triaged AND variants >= threshold AND coverage >= threshold AND retention >= threshold

**Output:**
```typescript
interface ObjectiveProficiencyResult {
  objectiveId: string;
  priority: ObjectivePriority;
  retentionStrength: number;
  practiceCoverage: number;
  fluencyConfidence: EvidenceConfidence;
  evidenceConfidence: EvidenceConfidence;
  isProficient: boolean;
  reasons: string[];
  variantDetails: PracticeVariantDetail[];
}
```

### 13.3 Misconception Lifecycle

A misconception is `active` when detected and becomes `resolved` after N consecutive clean attempts on the affected skill(s) (N is domain-configurable, default 3). While `active`:

- Its `remediated_by` activity is injected into the planner queue ahead of normal progression (§12.7).
- It contributes to `weaknessFit` in the next-skill planner (§10).
- It is counted in `activeMisconceptionCount` in teacher/student views (§9).

### 13.4 Student and Teacher Views

Proficiency results are projected into role-specific views:

**Student View:**
- `proficiencyLabel`: derived from `isProficient` and `evidenceConfidence`:
  - `not_started`: evidenceConfidence === 'none'
  - `in_progress`: evidenceConfidence === 'low' OR (evidenceConfidence >= 'medium' AND !isProficient)
  - `proficient`: isProficient === true AND evidenceConfidence >= 'medium'
  - `mastered`: isProficient === true AND evidenceConfidence === 'high' AND fluencyConfidence === 'high'
- `guidance`: Actionable next step text

**Teacher View:**
- All student view fields plus:
- `standardCode`, `standardDescription`
- `isProficient` boolean
- `missingBaselines`: Practice variants without timing baselines
- `lowConfidenceReasons`: Diagnostic reasons
- `classProficientCount`, `classAvgRetention`, `classStrugglingStudents`

### 13.5 SRS Proficiency Utilities

```typescript
// Convert FSRS stability to retention probability
function stabilityToRetention(stability: number): number;

// Aggregate multiple card states into evidence per practice variant
function aggregateCardsToEvidence(
  cards: ProficiencyCardInput[],
  timingBaselines: TimingBaselines,
): PracticeVariantEvidence[];
```

---

## 14. Cross-Course Equivalence

The equivalence system identifies when the same skill appears across different courses, allowing SRS and teacher evidence to treat them as a single learner-state target.

### 14.1 Equivalence Edge

```typescript
// equivalent_to edges connect nodes across courses (identity relationship)
{
  type: 'equivalent_to',
  sourceId: 'math.im3.skill.m1.l2.solve-quadratic',
  targetId: 'math.im2.skill.m3.l1.solve-quadratic',
  weight: number,
  confidence: ConfidenceLevel,
}
```

### 14.2 Cross-Course Equivalence Detection

**Methods for identifying equivalence:**

| Method | Description | Confidence |
|--------|-------------|------------|
| `intra-course-equivalence-v1` | Concepts sharing `familyKey` within a course | low |
| `cross-course-metadata-match` | Nodes with matching metadata fields across courses | medium |
| `cross-course-standard-alignment` | Nodes aligned to the same standard across courses | medium |
| `cross-course-difficulty-similarity` | Nodes with similar difficulty and similar labels | low |

### 14.3 Equivalence Components

Equivalent nodes form connected components (undirected graph traversal):

```typescript
interface EquivalenceComponentSummary {
  componentId: string;           // "equiv-comp-001"
  nodeIds: string[];             // All nodes in this component
  coursesCovered: string[];      // Unique course/domain identifiers
  edgeCount: number;             // Number of equivalent_to edges
}
```

### 14.4 Cross-Course Validation

Validation checks for cross-course edges:
- Both source and target nodes must exist in their respective course graphs
- Edge must be bidirectional in effect (A equivalent to B implies B equivalent to A)
- No self-loops (a node cannot be equivalent to itself)

---

## 15. Domain Adapter Pattern

Domain adapters allow specific domains (math, English/GSE, science) to validate domain-specific metadata without modifying the core package.

### 15.1 Domain Adapter Interface

```typescript
interface DomainAdapter {
  domain: string;  // e.g. "math.im3", "english.gse"
  validateNodeMetadata(
    node: KnowledgeSpaceNode
  ): { valid: boolean; errors?: string[] };
}
```

### 15.2 Adapter Responsibilities

A domain adapter validates:
- Required metadata fields for the domain (e.g., `cefr` for English, `gradeLevel` for math)
- Metadata value ranges and formats
- Domain-specific node kind constraints
- Cross-field consistency within metadata

### 15.3 Boundary Rules

1. Reusable packages (`knowledge-space-core`, `knowledge-space-practice`) must **not** import domain-specific code
2. Domain adapters live in domain packages, not in reusable packages
3. The core package provides the adapter interface; domain packages provide implementations
4. Validation is called at graph ingestion time, not at runtime

### 15.4 Example: Math Domain Adapter

```typescript
const mathAdapter: DomainAdapter = {
  domain: 'math',
  validateNodeMetadata(node) {
    const errors: string[] = [];
    if (node.kind === 'skill') {
      if (typeof node.metadata.bloomsLevel !== 'string') {
        errors.push('skill nodes require metadata.bloomsLevel');
      }
      if (typeof node.metadata.module !== 'string') {
        errors.push('skill nodes require metadata.module');
      }
    }
    return { valid: errors.length === 0, errors };
  },
};
```

### 15.5 Example: English/GSE Domain Adapter

```typescript
const englishGseAdapter: DomainAdapter = {
  domain: 'english.gse',
  validateNodeMetadata(node) {
    const errors: string[] = [];
    if (node.kind === 'skill') {
      if (typeof node.metadata.cefr !== 'string') {
        errors.push('skill nodes require metadata.cefr');
      }
      if (typeof node.metadata.gseRange !== 'string') {
        errors.push('skill nodes require metadata.gseRange');
      }
      if (typeof node.metadata.modality !== 'string') {
        errors.push('skill nodes require metadata.modality');
      }
    }
    return { valid: errors.length === 0, errors };
  },
};
```

---

## 16. Level Projection

The README markets "no level barriers" but the apps ship levels 1–18. Levels are **presentation-only** — a projection, never an input to any KST/SRS computation.

### 16.1 Definition

A level projection is a domain-supplied monotonic function from knowledge state → display level:

```
getDisplayLevel(knowledgeState, levelMap) → number
```

The existing `gse-to-*-advantage.csv` files are exactly this mapping.

### 16.2 Rules

1. Levels are derived from the knowledge state, never stored independently.
2. The level function is monotonic: more mastered skills → same or higher level, never lower.
3. Levels are not used in readiness computation, queue ordering, or proficiency assessment.
4. Domains supply their own level map; the engine is agnostic.

---

## Appendix A: Implementation Package Map

| Package | Responsibility | Must Not Import |
|---------|---------------|-----------------|
| `knowledge-space-core` | Graph types, schemas, validation, edge suggestions, edge calibration, equivalence | App code, Convex generated, domain content |
| `knowledge-space-practice` | Blueprint contracts, generators, projections, synthetic fixtures | Domain content, standards catalogs, app outputs |
| `srs-engine` | FSRS scheduler, queue, review processor, proficiency, placement | App code, Convex generated |
| `practice-core` | Practice contract, timing, SRS rating, error analysis, misconception lifecycle | App code, domain-specific logic |

## Appendix B: Synthetic Fixtures

Reusable packages ship with synthetic fixtures for testing only. These contain no proprietary curriculum data.

| Fixture | Domain | Purpose |
|---------|--------|---------|
| `syntheticMathFixture` | math.im3 | Tests graph validation, projections, SRS inputs |
| `syntheticEnglishGseFixture` | english.gse | Tests cross-domain compatibility |
| `syntheticAlgebraicBlueprint` | algebra | Tests blueprint validation and generation |
| `syntheticGraphingBlueprint` | graphing | Tests graphing-specific blueprints |
| `syntheticEnglishBlueprint` | english | Tests language-domain blueprints |

## Appendix C: Versioning

| Component | Current Version | Notes |
|-----------|----------------|-------|
| Knowledge Space Schema | `knowledge-space.v2` | Added `transfers_to`, `remediated_by` edge types |
| SRS Contract | `srs.contract.v2` | `variantKey` replaces `problemFamilyId`; `siblingReinforcement` optional |
| Practice Contract | `practice.v1` | Unchanged; added `misconceptionCapped` to rating result |
| Student Visualization | `v1` | `recommendedNext` now top-N by priority (§10) |
| Parent Visualization | `v1` | `progressTrend` is real time-delta (§9.4) |
| Teacher Visualization | `v1` | Added `activeMisconceptionCount` |
