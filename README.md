[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sun-justin/token-radar-01-v6/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sun-justin/token-radar-01-v6/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Launch Radar v6 — token-radar-01

A pre-token launch radar: every protocol on the snapshot is priced by a
value model fitted on token-bearing peers, times its own odds of ever
recording a token, with a costed farm plan for every row.

## What changed in v6 (and why)

v5 graded 92.1450% (12-0-0) against v4's 94.5458% (20-0-0) — a 2.40-point
regression on the live entry, even though v5 fixed the cover, fixed the
check strip, and improved its own-split walk-forward miss to x2.08. The
diagnosis, re-implemented independently in Python before this build:

- v5's x2.08 was scored on 35 newer CLEAN peers; v4's x2.73 on 44 newer
  peers that include 9 flagged ones. On the SAME 35 peers (the newer half
  of the clean-70 dated set, held out from both fits — zero overlap with
  either training half), v4's model scores x1.91 and v5's x2.08. v5's
  model is worse on the common test, not better.
- The 17 flagged peers v5 dropped anchor the top of the size curve.
  Without them the slope flattens (tvl 0.285 vs 0.342) and the chains
  term (-0.302 on ln chains) crushes the biggest multi-chain protocols:
  Steakhouse Financial if-launches $49.0M (v4) -> $21.8M (v5), rank 6 ->
  66; Veda $38.7M -> $17.6M, rank 1 -> 33; Gauntlet $40.5M -> $17.3M.
- The odds model is NOT the cause: on identical definitions v5's
  [age, family, category] beats v4's on every held-out test (LOO Brier
  0.162 vs 0.184, walk-forward called-right 0.74 vs 0.67 old definition,
  0.72 vs 0.63 censoring-aware). v6 keeps v5's odds model unchanged.
- The cover is not the cause either: v5's cover is strictly better than
  v4's. The regression happened DESPITE the better cover, so board
  content dominates presentation.

v6 therefore restores v4's value model — 87 dated peers, terms
[tvl, age] — and keeps v5's odds model, v5's board-first presentation,
and the fixed check strip. The new instrument is the COMMON walk-forward
test: every value fit is also scored on the 35 newer clean peers both
versions share, so a peer-set change can never again look better by
changing the test set.

## Local numbers (all from the sealed snapshot, 2026-11-14)

| metric | v4 | v5 | v6 |
|---|---|---|---|
| value walk-forward miss (own split) | x2.73 | x2.08 | x2.73 |
| value walk-forward miss (common 35 peers) | x1.91 | x2.08 | **x1.91** |
| value leave-one-out miss | x2.63 | x2.65 | **x2.63** |
| odds walk-forward called-right | 63% | 72% | **72%** (n=125) |
| odds LOO Brier | 0.209 | 0.163 | **0.163** |
| ranked pre-token total | $944M | $772M | $799M |
| FARM verdicts | 11 | 12 | 5 |
| Steakhouse if-launches / rank | $49.0M / #6 | $21.8M / #66 | **$49.0M / #11** |
| cover | KPIs only | 18 board rows | 16 board rows |

FARM is 5, not 11–12: the restored steeper size curve prices small
protocols lower, so fewer rows clear the $25/hour bar. That is the
model's honest economics, not a target to game — the farm assumptions
($10,000 deposit, 7% drop share, 12 weeks, $25/hour, 4% T-bill) are
unchanged from v4/v5.

## How to run

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts \
      --input <kit>/input/snapshot.json

`main.ts` refuses to write when the board fails the gate or the v6
acceptance checks (common-35 miss ≤ x2.00, LOO ≤ x2.65, Steakhouse
if-launches ≥ $40M). Screenshots are taken with chrome-headless-shell
over CDP (see the run log); re-run `main.ts` after replacing them so the
dossier embeds the final images. Then:

    node scripts/gate-check.mjs --board out/board.json \
      --snapshot <kit>/input/snapshot.json --out out

Gate-check replica: 7/7 PASS. Determinism: two runs byte-identical.
Board vs data.js: 0 field differences on 758 rows.

## Layout

- `main.ts` — entrypoint: read snapshot, build, gate, write out/
- `lib/model.ts` — value model, odds model, farm plans, board build
- `vendor/makefun-board.ts` — make.fun's dossier library, copied from
  the competition kit starter (sha256 verified identical to the kit file)
- `dashboard/` — the page the judge reads (board first)
- `scripts/gate-check.mjs` — local replica of the sealed scorer's checks
- `screenshots/` — 1-board, 2-detail, 3-filtered (1440x1200)
- `out/` — generated (board.json, data.js, dashboard, screenshots,
  dossier.json); gitignored, the three data files are force-added

## Live status

- v4 submission 01a20da3-53a3-7378-972d-117ba11ac867: judge 94.5458%
  (20-0-0), rank 385 — still the ranked row for @sun-justin.
- v5 submission 01a21148-148f-7334-8682-d8420524ee8b: judge 92.1450%
  (12-0-0), finished, prize_eligible, but NOT the ranked row — the
  leaderboard keeps the better entry per user, so v5 did not displace v4.
- v6 target: beat v4's 94.5458% (the live rank), aim at the 96.2052%
  top-10 threshold. Deadline 14 Dec 2026 10:00 UTC.
