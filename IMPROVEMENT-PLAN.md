# Knowledge Space + SRS — Specification Improvement Plan

> **Status:** ✅ All items completed. Specification updated to `kst-srs.v2`.

## Completed

All 9 items have been implemented in `SPECIFICATION.md`:

- [x] **Item 1** — Knowledge State & Mastery section with hysteresis, time-aware outer fringe, decay propagation, thresholds (§2)
- [x] **Item 2** — Weighted readiness formula, `weight` as live field, node-state computation updated (§2.5, §9.4)
- [x] **Item 3** — Edge Calibration section with contingency table, Beta-Bernoulli posterior, recency decay, confounding guardrail, human review queue (§6)
- [x] **Item 4** — Next-Skill Planner with composite priority score, top-N `recommendedNext` (§10)
- [x] **Item 5** — Placement section with adaptive tree walk, abstract probe interface, reference implementations (§11)
- [x] **Item 6** — `remediated_by` edge type, rating cap rule, misconception lifecycle, projections (§3.2, §3.7, §8.4, §13.3)
- [x] **Item 7** — "Problem family" → "practice variant" renamed throughout; `Card` redefined with `variantKey`; no new node kind (§12.1, §13)
- [x] **Item 8** — FSRS per-card limitation documented; `transfers_to` edge defined; Level Projection added; `progressTrend` made real time-delta (§12.9, §3.2, §16, §9.4)
- [x] **Item 9** — README.md updated; all types defined; naming consistent; version bumped to v2 (README.md, §7.7, Appendix C)

## Dependency Order (as executed)

```
Item 1 (mastery model)  ──┬──> Item 2 (weighted readiness) ──> Item 4 (planner)
                          │
                          ├──> Item 3 (edge calibration)
                          ├──> Item 5 (placement)
                          ├──> Item 6 (misconceptions) ──────> Item 4 (weaknessFit term)
                          └──> Item 7 (practice variant)
Item 8, Item 9 ── independent; done last.
```
