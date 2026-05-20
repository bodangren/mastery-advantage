# Mastery Advantage — Zhongwen Domain

> **Status: Planning** — This domain is not yet implemented.

**Zhongwen Advantage** is the Chinese language learning app in the Advantage suite.

---

## Brand

| Property | Value |
|----------|-------|
| Color | Fuchsia |
| Primary | `#e879f9` (fuchsia-400) |
| Light | `#f0abfc` (fuchsia-300) |
| Dark | `#86198f` (fuchsia-800) |
| Logo | `assets/logos/zhongwen-advantage.png` |

---

## Planned Scope

| App | Audience | Knowledge Framework | Level System |
|-----|----------|---------------------|--------------|
| **Zhongwen Advantage** | Thai students learning Mandarin Chinese | HSK framework or custom | TBD |

---

## Label System

Zhongwen Advantage uses **HSK levels** (1–9) rather than CEFR as its primary proficiency axis. This affects the knowledge graph schema:

- Cluster labels in the visualization use HSK-1 through HSK-9 instead of A1–C2
- The level mapping CSV maps HSK levels to internal app levels (not GSE scores)
- Difficulty scores (0–1) are normalized from HSK 1–9 rather than CEFR/GSE range

The shared graph schema and outer fringe algorithm are identical — only the labeling and level mapping differ.

## Open Questions

- **Framework:** HSK (汉语水平考试) levels 1–9 as the primary skill axis, potentially supplemented for younger Thai learners below HSK-1.
- **Script vs. spoken:** Does the knowledge graph cover character recognition, pinyin, spoken comprehension, and reading as separate but linked skill tracks?
- **Character prerequisites:** Chinese character learning has strong prerequisite relationships based on component radicals — this could make for a uniquely detailed prerequisite graph.
- **Thai-Chinese specific challenges:** Are there specific interference patterns or transfer skills from Thai to Chinese that should be modeled as domain-specific edges?

---

## Next Steps

1. Choose the curriculum framework (HSK or custom)
2. Define the skill taxonomy — at minimum: characters, vocabulary, grammar structures, reading comprehension
3. Map prerequisite relationships (especially for characters via radicals)
4. Build `zhongwen-knowledge-space.json` conforming to the [shared graph schema](../README.md#domain-knowledge-graph-schema)
5. Create level mapping CSV
6. Update this README with the completed structure

---

## References

- HSK Standard Course — Hanban / Confucius Institute Headquarters
- TOCFL (Test of Chinese as a Foreign Language) — for cross-reference
