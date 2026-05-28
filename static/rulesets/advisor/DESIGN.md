# 导师模拟器 / Advisor Simulator — design notes

A data-only reskin of the phd-game engine. **You never touch `src/`** — the whole
game lives in this folder's YAML + `static/index.html`'s `app_config`.

## Run it
```bash
module load nodejs/20.12.2     # on BU SCC; or just have node 20 on PATH
npm install                    # first time only
npm run build && npm start     # -> http://localhost:8000
```
Switch back to the original PhD sim by pointing the paths in `static/index.html`
(`app_config`) from `rulesets/advisor/` to `rulesets/default/`.

## The 7 files
| file | what it holds |
|---|---|
| `events.yaml` | **all game logic** — the tick loop, the monthly choice, paper resolution, endings, random event cards |
| `attributes.yaml` | hidden numeric "boost" stats that status/items modify |
| `items.yaml` | things shown in the right "Lab" panel (badges, assets) |
| `status.yaml` | timed/permanent buffs+debuffs (each can modify attributes) |
| `gui.yaml` | which meters show in the top bar, footer buttons |
| `lang.en.yaml` / `lang.zh.yaml` | every string, keyed; `{{var}}` interpolates, `**md**` works |

## What's implemented (v3)
- **State**: `lab.morale`, `pi.funding`, `pi.reputation`, plus a **lab**: `lab.students`, `lab.compute` (GPU tier 0–5), `lab.talent` (avg quality), `lab.progress`, `lab.draftsReady`, `pi.papers`.
- **Automatic production**: every month the lab adds `floor(students * 5 * (1+compute*0.20) * clip(morale/65,0.4,1.5) * clip(talent,0.7,1.6))` to `lab.progress`. More/better-resourced students = faster papers. Runs regardless of your action.
- **7 monthly actions** (some conditional via `requirement`): Crunch (deadline-boosted), Mentor, Write Grant, Network, Protect work-life, **Buy GPUs** (spend funding → compute), Polish (acceptance buff).
- **Yearly recruiting** (Years 2–6): a self-re-triggering `RecruitRound` (fired at priority 2 so it runs before the month) lets you hire **multiple people per year** — Strong PhD (needs rep≥32) / Regular / Postdoc / "that's enough" — each option `requirement`-gated by funding and capped at 12 students. Headcount raises stipend burn but boosts production.
- **Funding as a budget**: monthly burn = `students*stipend(2) + compute − 2` (institutional support). Grant **success scales with reputation** — `clip(0.35 + rep/250, 0.2, 0.7)`, so junior PIs land ~43% and established ones up to ~70% — for `randi(20)+24+rep/4` (bigger reputation also wins bigger awards).
- **Conference calendar + batch submission**: research banks into drafts (`lab.progress`, every 100 = 1 draft). Deadlines are **~3 months apart** — ICML(2) NeurIPS(5) AAAI(8) CVPR(11) — so a bigger lab banks several drafts and submits them together. `ConferenceSubmit` converts banked progress into `lab.draftsReady` and a `Loop` reviews **all of them at once**. `ConferenceOpens` (earlier in the month) announces the venue, sets `conf.accMod`/`conf.prestige`, and sets `deadlineCrunch`. Top venues: harder (`accMod −0.04`) but more reputation (`prestige 1.3`); AAAI is the easier/lower-prestige mid venue. Accept ≈ `clip(0.45 + rep/200 + buff + compute*0.03 + conf.accMod, …)`; reject refunds ~45 progress for a resubmission at the next venue.
- **Reputation coupling**: driven mainly by accepted papers (×venue prestige); networking adds `1 + min(papers,6) + randi(3)` so it's near-worthless with no papers.
- **Retention**: morale <30 risks a student quitting; `students≤0` ends the game.
- **Endings**: morale=0 implode; funding=0 bankrupt; lab empty; Year-7 tenure review → **dream** (`papers≥10 && rep≥50`) / **tenure** (`papers≥4`) / denied. A few papers earns tenure; the dream is the stretch goal.
- **4 event cards**: Reviewer 2, industry offer, cluster outage, windfall.

### Tuning (verified by a 400-run Monte-Carlo of the monthly loop, `tools/balance_sim.js`)
Near-optimal **cautious** play: ~97% survive, ~always tenure, **~90% dream**. **Growth** play: ~85% survive (over-expanding with reputation-gated grants still risks bankruptcy) and **multi-submits ~9% of deadlines** (up to ~6 papers at once), avg ~16 papers. Deliberately forgiving — tenure is reliable, the dream is a mild stretch. Knobs: `Init` (`rule.*`, starting values), the production/acceptance expressions, the rep-scaled grant weights, venue `conf.*` in `ConferenceOpens`, `status.yaml` drains. **The sim is a separate model — mirror any number change between it and the YAML, then re-run it.**

## Engine vocabulary (cheat sheet)
- **Triggers**: `Initialization`, `Tick`, `MonthBegin`, `YearBegin` (custom ones via `TriggerEvents`).
- **Event fields**: `trigger`, `once`, `probability`, `conditions` (`{id: Expression, expression: ...}`), `exclusions`, `actions`.
- **Actions**: `UpdateVariables`, `UpdateVariableLimits`, `SetStatus`, `GiveItem`, `DisplayMessage`,
  `DisplayChoices`, `Random` (groups+`weight`), `Switch` (every branch needs a `condition`; use `condition: 1` for default), `TriggerEvents`, `EndGame`.
- **Expressions**: `+ - * / %`, `===`, `&&`, `||`, `randi(n)` (0..n-1), `floor/round/ceil`,
  `min/max`, `clip(x,lo,hi)`, `getAttributeValue('id')`, `hasStatus('id')`. Booleans act as 1/0 in arithmetic (e.g. `hasStatus('x') * 16`).
- **DisplayChoices**: each choice takes an optional `requirement` expression — the option only appears when it's true (used to hide unaffordable actions/recruits).

## Next design steps (suggested)
1. **Named individual students** — promote the headcount to a few real student entities with their own ability/morale/year, so Mentor/Push and burnout/quitting target individuals. Biggest remaining upgrade.
2. **Advisor archetypes** — opening choice that sets starting attributes (点子王 / 连接者 / 盾牌 / 机器).
3. **More event cards** — cheap to add; this is where flavor + replayability live.
4. **Student outcomes** — graduations (a student leaves but adds prestige), job-market events.
5. **Re-tune** via `/tmp/advsim.js` after any change to production/acceptance/economy.
