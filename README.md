# Mastery Advantage

> *Know exactly where every student is. Know exactly what they're ready to learn next.*

**Mastery Advantage** is the adaptive learning engine shared across the Advantage suite of educational apps. It combines [Knowledge Space Theory (KST)](https://en.wikipedia.org/wiki/Knowledge_space) with spaced repetition to build a precise, personalized map of each student's progress through a domain — and to surface the next skill they are ready to learn.

This repository is the single source of truth for all Mastery Advantage data, theory, and implementation planning across every subject domain.

---

## The Science

### Knowledge Space Theory

Developed by Doignon & Falmagne (1985), KST models a learning domain as a directed graph of skills where edges represent prerequisite relationships. A student's **knowledge state** is the set of skills they have mastered. The **outer fringe** of that state — skills not yet mastered but whose prerequisites are all met — is the exact set of things a student is ready to learn right now.

This is fundamentally different from linear level systems or random practice queues. It means:
- Every student gets a unique learning path based on what *they specifically* know.
- The system never asks a student to learn something for which they are not yet ready.
- There are no arbitrary level barriers — readiness is determined by mastery, not time.

### Spaced Repetition

Once a skill enters a student's knowledge state, it is scheduled for review using spaced repetition — review intervals that expand as the skill is retained. This ensures that mastered skills stay mastered, rather than decaying quietly in the background.

### The Combination

KST determines *what* to learn next. Spaced repetition determines *when* to review what has already been learned. Together they produce a system where students are always working at the exact edge of their ability — the optimal zone for learning — while never losing ground on what they have already built.

---

## The Apps

Mastery Advantage is implemented across the Advantage suite. Each app has its own domain knowledge graph built on the same underlying engine.

### Reading Suite

Three apps form a continuous English reading progression from ages 5 through 18:

| App | Audience | Framework | Brand | Status |
|-----|----------|-----------|-------|--------|
| **Storytime Advantage** | Lower primary, ages 5–8 | Early literacy / phonics + lower GSE YL | Amber `#fbbf24` | Planning |
| **Primary Advantage** | Upper primary, ages 8–11 | Pearson GSE — Young Learners (Pre-A1–B2) | Cyan `#22d3ee` | Production |
| **Reading Advantage** | Secondary, ages 11–18 | Pearson GSE — Adult Learners (A1–C2) | Sky `#38bdf8` | Production |

All three share the same English knowledge domain in [`english/`](english/). Students progress through Storytime → Primary → Reading Advantage along a single continuous skill continuum.

### Other Subject Apps

| App | Domain | Audience | Framework | Brand | Status |
|-----|--------|----------|-----------|-------|--------|
| **Math Advantage** | Mathematics | K–12 | Thai national math curriculum | Orange `#fb923c` | Planning |
| **Science Advantage** | Science | K–12 | Thai national science curriculum | Rose `#fb7185` | Planning |
| **STEM Advantage** | Integrated STEM | Upper primary / secondary | Cross-domain (Math + Science + Engineering) | Indigo `#818cf8` | Planning |
| **Zhongwen Advantage** | Chinese language | All ages | HSK framework | Fuchsia `#e879f9` | Planning |
| **Tutor Advantage** | AI tutoring — all domains | All ages | Operates across all domain graphs; scope expanding | Emerald `#34d399` | Planning |

---

## Repository Structure

General theory, brand assets, and cross-domain shared resources live at the root. Each subject domain has its own subdirectory containing the knowledge graph data, level mappings, implementation notes, and visualizations specific to that domain.

```
mastery-advantage/
│
├── README.md                        ← This file — overview and theory
├── README-th.md                     ← Thai-language version
│
├── assets/                          ← Brand and marketing assets
│   ├── mastery-advantage-graph.svg  ← Master knowledge graph SVG (all domain themes)
│   ├── mastery-advantage-demo.html  ← Interactive demo (8 app themes + layer toggles)
│   └── logos/                       ← App logo files
│
├── english/                         ← English reading domain (Storytime + Primary + Reading Advantage)
│   ├── README.md
│   ├── gse-md/                      ← GSE learning objectives (human-readable markdown)
│   ├── gse-knowledge-space.json     ← Full KST graph: ~2,000 skill nodes + edges
│   ├── gse-to-reading-advantage.csv ← GSE score → RA level mapping (levels 1–18)
│   ├── gse-to-primary-advantage.csv ← GSE score → PA level mapping (levels 1–14)
│   ├── scripts/                     ← Graph generation + visualization build tools
│   ├── index.html                   ← GSE Learning Objectives Explorer
│   └── knowledge-space-viz-standalone.html
│
├── storytime/                       ← Storytime Advantage (lower primary) — planning
│   └── README.md
│
├── math/                            ← Math Advantage — planning
│   └── README.md
│
├── science/                         ← Science Advantage — planning
│   └── README.md
│
├── stem/                            ← STEM Advantage (integrated) — planning
│   └── README.md
│
├── zhongwen/                        ← Zhongwen Advantage (Chinese) — planning
│   └── README.md
│
├── tutor/                           ← Tutor Advantage (cross-domain AI tutoring) — planning
│   └── README.md
│
└── code/                            ← Code Advantage — planning
    └── README.md
```

---

## The Mastery Advantage Visual Language

The knowledge graph visualization is the signature brand element of Mastery Advantage. The master SVG lives in `assets/mastery-advantage-graph.svg` and is designed to flex across every context: website hero, TikTok B-roll, sales decks, school demos, and in-app UI.

**Node states:**

| State | Color | Meaning |
|-------|-------|---------|
| Mastered | Green | Student has demonstrated mastery |
| You are here | White | Current focus skill |
| Ready to learn | Amber | Prerequisites met, ready to unlock |
| Locked | Dark blue | Prerequisites not yet complete |

**Domain themes** — the same SVG, recolored by `data-domain` attribute:

| Domain | Accent color |
|--------|-------------|
| English (Reading/Primary) | Emerald green |
| Math | Rose red |
| Science | Violet |
| Code | Cyan |

Open `assets/mastery-advantage-demo.html` in a browser to see all themes and layer toggles live.

---

## The Outer Fringe Algorithm

This is the core computation shared across all domain implementations. The v2 specification defines a **time-aware, weighted** outer fringe that accounts for skill decay and prerequisite strength. See [§2 Knowledge State & Mastery](SPECIFICATION.md#2-knowledge-state--mastery) for the full algorithm including hysteresis, weighted readiness, and decay propagation.

The simplified version below shows the core logic (binary mastery, no weights):

```typescript
function getOuterFringe(
  masteredSkills: Set<string>,
  graph: { nodes: SkillNode[]; edges: Edge[] }
): SkillNode[] {
  const prereqEdges = graph.edges.filter(e => e.type === 'prerequisite_for');

  // Build: skillId → set of prerequisite skillIds
  const prereqsFor = new Map<string, Set<string>>();
  for (const edge of prereqEdges) {
    if (!prereqsFor.has(edge.targetId)) prereqFor.set(edge.targetId, new Set());
    prereqsFor.get(edge.targetId)!.add(edge.sourceId);
  }

  return graph.nodes
    .filter(n => n.kind === 'skill')
    .filter(skill => {
      if (masteredSkills.has(skill.id)) return false;
      const prereqs = prereqsFor.get(skill.id);
      if (!prereqs || prereqs.size === 0) return true;
      return [...prereqs].every(p => masteredSkills.has(p));
    });
}
```

For the production algorithm with time-aware readiness scoring, see [§2.6 Time-Aware Outer Fringe Algorithm](SPECIFICATION.md#26-time-aware-outer-fringe-algorithm).

---

## Domain Knowledge Graph Schema

The canonical schema is defined in [SPECIFICATION.md](SPECIFICATION.md). The summary below is non-normative.

### Node

Nodes use a dot-separated lower-kebab-case ID pattern (e.g. `english.gse.skill.b1.reading.main-idea`), a `kind` from 11 possible values, a `title` string, and domain-specific `metadata`. See [§3 Knowledge Space Data Model](SPECIFICATION.md#3-knowledge-space-data-model) for the full schema.

### Edge

Edges have a typed relationship (`prerequisite_for`, `contains`, `supports`, `aligned_to_standard`, and 9 others including `remediated_by` and `transfers_to`), a `weight` (0–1, consumed by weighted readiness), and a `confidence` level. See [§3.2 Edge Types](SPECIFICATION.md#32-edge-types) and [§3.4 Edge Schema](SPECIFICATION.md#34-edge-schema) for the full schema.

---

## Adding a New Domain

To add a new subject domain to Mastery Advantage:

1. **Create the subdirectory** — `mkdir <domain>` (e.g. `math/`, `science/`).
2. **Define the skill taxonomy** — the list of discrete learnable skills, each with a unique ID and difficulty score. Source from the relevant curriculum framework (Thai national curriculum, international standards, etc.).
3. **Map prerequisite relationships** — define which skills require other skills. This can be done manually for small domains, or generated from the curriculum structure + expert review.
4. **Build the knowledge graph** — output a `<domain>-knowledge-space.json` file conforming to the schema in [SPECIFICATION.md](SPECIFICATION.md).
5. **Create level mappings** — a CSV mapping internal app levels to difficulty ranges within the graph.
6. **Write `<domain>/README.md`** — document the curriculum source, skill count, level mappings, and any domain-specific decisions.
7. **Add a row to the apps table** in this README.

---

## Research Foundation

- Doignon, J.-P., & Falmagne, J.-C. (1985). Spaces for the assessment of knowledge. *International Journal of Man-Machine Studies*, 23(2), 175–196.
- Falmagne, J.-C., & Doignon, J.-P. (2011). *Learning Spaces: Interdisciplinary Applied Mathematics*. Springer.
- Ebbinghaus, H. (1885). *Über das Gedächtnis*. (The forgetting curve — basis for spaced repetition scheduling.)
- Pearson (2019). *Global Scale of English Learning Objectives for Adult Learners*.
- Pearson (2022). *Global Scale of English Learning Objectives for Young Learners*.

---

## Contributing

- **Domain data:** Each domain subdirectory is self-contained. See `<domain>/README.md` for contribution guidelines specific to that domain.
- **Shared algorithm changes:** Changes to the outer fringe algorithm or graph schema affect all domains — document the migration path in this README before merging.
- **Brand assets:** The master SVG in `assets/` is the single source of truth for the Mastery Advantage visual. Edit it in Figma, export with IDs preserved, and replace the file here.
