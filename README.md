# GSE Knowledge Space

This repository contains the data layer, mapping files, and visualization tools that power **adaptive questioning** in the [Reading Advantage](https://reading-advantage.com) and [Primary Advantage](https://primary-advantage.com) apps.

> **Goal:** Use the [Global Scale of English (GSE)](https://www.english.com/gse) together with [Knowledge Space Theory (KST)](https://en.wikipedia.org/wiki/Knowledge_space) to present each student with questions that sit exactly on the edge of their current ability — not too easy, not too hard, but in the **outer fringe** of what they are ready to learn next.

---

## The Big Idea

Both apps teach English by asking students to read passages and answer comprehension questions. The challenge is selecting the *right* passage at the *right* difficulty.

**Knowledge Space Theory (KST)** models learning as a structured space of skills (or "objectives"). A student's "knowledge state" is the set of objectives they have already mastered. The **outer fringe** of that state is the set of objectives they have not yet mastered, but for which they possess all the prerequisite skills. These are the objectives a student is *ready* to learn — the "edge of their ability."

This repository:
1. **Maps** every GSE objective to our app's internal level system (PA levels for primary students, RA levels for secondary students).
2. **Models** prerequisite relationships between GSE objectives as a directed graph.
3. **Visualizes** that graph so we can reason about learning paths and validate the structure.

The Next.js apps (TypeScript) consume the CSV mapping files and the knowledge-space graph to decide which question to show next.

---

## The Apps

| App | Audience | GSE Framework | Level System | GSE Range |
|-----|----------|---------------|--------------|-----------|
| **Primary Advantage** | Primary school students (ages 6–11) | Young Learners | PA (Primary Advantage) | 10–70 |
| **Reading Advantage** | Secondary school students (ages 11–18) | Adult Learners | RA (Reading Advantage) | 10–90 |

---

## File Structure

```
.
├── assets/                                   # Images for visualizations
│   ├── adults-cover.png
│   ├── adults-group.png
│   ├── illustration.png
│   └── yl-cover.png
│
├── gse-md/                                   # Source GSE data (human-readable)
│   ├── adult-learners/
│   │   ├── listening.md                      # Adult Listening objectives by GSE range
│   │   ├── reading.md                        # Adult Reading objectives by GSE range
│   │   ├── speaking.md                       # Adult Speaking objectives by GSE range
│   │   └── writing.md                        # Adult Writing objectives by GSE range
│   ├── young-learners/
│   │   ├── listening.md                      # Young Learner Listening objectives
│   │   ├── reading.md                        # Young Learner Reading objectives
│   │   ├── speaking.md                       # Young Learner Speaking objectives
│   │   └── writing.md                        # Young Learner Writing objectives
│   └── gse-all.json                          # All objectives as a single JSON array
│                                               (the canonical source for generation scripts)
│
├── scripts/
│   ├── generate-knowledge-space.js           # Builds gse-knowledge-space.json from gse-all.json
│   └── build-standalone-viz.js               # Inlines the JSON into the standalone HTML viz
│
├── gse-to-primary-advantage.csv              # Maps each GSE score (10–70) to a PA level (1–14)
├── gse-to-reading-advantage.csv              # Maps each GSE score (10–90) to an RA level (1–18)
│
├── gse-knowledge-space.json                  # The full KST graph: nodes (skills, units, standards)
│                                               and edges (prerequisite_for, supports, contains, etc.)
│
├── index.html                                # GSE Learning Objectives Explorer (browse/filter all objectives)
├── knowledge-space-viz.html                  # Interactive D3 visualization of the knowledge-space graph
├── knowledge-space-viz-standalone.html       # Same viz, but with the JSON data inlined (no server needed)
│
├── GSE-Adults.pdf                            # Original Pearson PDF (Adult Learners, 2019)
├── gse-learning-objectives-young-learners.pdf # Original Pearson PDF (Young Learners, 2022)
│
└── README.md                                 # This file
```

---

## GSE → App Level Mapping

The two CSV files are the simplest and most important files for the apps. They provide a direct lookup from any GSE score to the student's current app level.

### Primary Advantage (Young Learner GSE)

| PA Level | GSE Range |
|----------|-----------|
| 1 | 10–13 |
| 2 | 14–17 |
| 3 | 18–21 |
| 4 | 22–23 |
| 5 | 24–26 |
| 6 | 27–29 |
| 7 | 30–33 |
| 8 | 34–38 |
| 9 | 39–42 |
| 10 | 43–47 |
| 11 | 48–53 |
| 12 | 54–58 |
| 13 | 59–64 |
| 14 | 65–70 |

**File:** `gse-to-primary-advantage.csv`  
**Format:** `gse,pa_level` (one row per GSE score)

### Reading Advantage (Adult GSE)

| RA Level | GSE Range |
|----------|-----------|
| 1 | 10–16 |
| 2 | 17–23 |
| 3 | 24–29 |
| 4 | 30–33 |
| 5 | 34–38 |
| 6 | 39–42 |
| 7 | 43–47 |
| 8 | 48–53 |
| 9 | 54–58 |
| 10 | 59–64 |
| 11 | 65–70 |
| 12 | 71–75 |
| 13 | 76–78 |
| 14 | 79–81 |
| 15 | 82–84 |
| 16 | 85–86 |
| 17 | 87–88 |
| 18 | 89–90 |

**File:** `gse-to-reading-advantage.csv`  
**Format:** `gse,ra_level` (one row per GSE score)

---

## Knowledge Space Graph

`gse-knowledge-space.json` is a directed graph that models the learning domain.

### Node Types

| Kind | Description | Count |
|------|-------------|-------|
| `domain` | The root: "Pearson GSE" | 1 |
| `content_group` | A (age_group, skill) pair, e.g. "Adults — Reading" | 8 |
| `standard` | A CEFR level (Below A1, A1, A2, B1, etc.) | 10 |
| `instructional_unit` | A band of GSE scores within a content group, e.g. "Adults Reading — A1 (22–29)" | ~40 |
| `skill` | An individual "Can do" objective | ~2,000+ |

### Edge Types

| Type | Meaning |
|------|---------|
| `contains` | Structural: a domain contains content groups, which contain units, which contain skills. |
| `appears_in_context` | Reverse of `contains`: a skill appears within a specific unit. |
| `aligned_to_standard` | A skill is aligned to a CEFR level. |
| `supports` | Co-competency: skills at the *same* GSE score within the same track support each other. |
| `prerequisite_for` | **The key edge.** Skill A must be mastered before Skill B is reachable. These are generated probabilistically based on GSE score distance (looking back 1–4 points). |

### How the Graph Is Built

Run:

```bash
node scripts/generate-knowledge-space.js
```

This reads `gse-md/gse-all.json` and generates `gse-knowledge-space.json`.

The script creates prerequisite edges using deterministic seeded sampling:
- For each skill at score X, it looks at skills in the same (age, skill) track with scores X-4 to X-1.
- It selects 3–5 predecessors, weighted so that closer scores are more likely to be prerequisites.
- At least one predecessor must come from X-1 (the immediately preceding score).
- Edge weights decay with distance, and confidence is marked `high` / `medium` / `low` accordingly.

The script validates the graph (no duplicate IDs, no dangling edges) and detects prerequisite cycles (there should be none).

---

## For Developers (Next.js / TypeScript)

### Using the Level Mappings

The simplest integration is to import the CSV files into your app and use them to convert a student's app level to a GSE range (or vice versa) when fetching passages or questions.

```typescript
// Example: load the mapping into a Map<number, number>
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const csv = fs.readFileSync('./gse-to-primary-advantage.csv', 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

const gseToPa = new Map<number, number>();
for (const row of records) {
  gseToPa.set(parseInt(row.gse), parseInt(row.pa_level));
}

// Get the PA level for a student who scored GSE 34
const level = gseToPa.get(34); // => 8
```

### Using the Knowledge Space Graph

For adaptive questioning, you will want to:

1. **Track the student's knowledge state** — a set of skill IDs they have demonstrated mastery of.
2. **Compute the outer fringe** — all skills whose prerequisites are fully contained in the student's knowledge state, but which the student has not yet mastered.
3. **Filter by GSE range** — narrow the outer fringe to skills within the student's current app level (using the CSV mapping).
4. **Select a passage/question** — pick a passage that exercises one of those skills.

The graph format is straightforward JSON. Each `skill` node has a unique `id`, a `difficulty` field (0–1, normalized from GSE 10–90), and `metadata.gseScore`. Edges are flat arrays with `sourceId`, `targetId`, and `type`.

```typescript
// Pseudo-code for computing the outer fringe
function getOuterFringe(studentState: Set<string>, graph: Graph): SkillNode[] {
  const mastered = studentState;
  const skills = graph.nodes.filter(n => n.kind === 'skill');
  const prereqEdges = graph.edges.filter(e => e.type === 'prerequisite_for');

  // Build a map: skillId -> set of prerequisite skillIds
  const prereqsFor = new Map<string, Set<string>>();
  for (const edge of prereqEdges) {
    if (!prereqsFor.has(edge.targetId)) prereqsFor.set(edge.targetId, new Set());
    prereqsFor.get(edge.targetId)!.add(edge.sourceId);
  }

  return skills.filter(skill => {
    if (mastered.has(skill.id)) return false; // Already mastered
    const prereqs = prereqsFor.get(skill.id);
    if (!prereqs) return true; // No prerequisites = fringe candidate
    return [...prereqs].every(p => mastered.has(p)); // All prereqs mastered
  });
}
```

---

## Visualizations

### GSE Learning Objectives Explorer

Open `index.html` in a browser to browse, search, and filter all GSE objectives. This is useful for content teams and curriculum designers.

### Knowledge Space Graph Visualization

Open `knowledge-space-viz.html` (requires a local server so it can fetch `gse-knowledge-space.json`) or `knowledge-space-viz-standalone.html` (works from `file://` since the data is inlined).

This is an interactive D3 force-directed graph that shows the prerequisite structure. It is useful for:
- Validating that the generated edges make sense.
- Identifying orphaned skills or unexpected clusters.
- Demonstrating the KST concept to stakeholders.

To rebuild the standalone version after updating the graph:

```bash
node scripts/build-standalone-viz.js
```

---

## Source Data

All objectives are sourced from Pearson's **Global Scale of English Learning Objectives**:
- **Adult Learners** — 2019 edition (`GSE-Adults.pdf`)
- **Young Learners** — 2022 edition (`gse-learning-objectives-young-learners.pdf`)

The markdown files in `gse-md/` were created from these PDFs for easier maintenance. `gse-all.json` is the machine-readable compilation of all four skills for both frameworks.

---

## Contributing

- **To update GSE data:** Edit the relevant `.md` files in `gse-md/`, then regenerate `gse-all.json` and the knowledge space graph.
- **To change level mappings:** Edit the CSV files directly, or regenerate them from the level definitions.
- **To modify prerequisite logic:** Edit `scripts/generate-knowledge-space.js` (e.g. adjust `PREREQ_DISTANCE_MAX`, `PREREQ_MIN`, or the weighting function).

Always validate the graph after generation — the script will fail if cycles or dangling edges are detected.
