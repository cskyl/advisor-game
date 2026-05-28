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

## What's implemented (v2)
- **State**: `lab.morale`, `pi.funding`, `pi.reputation`, plus a **lab**: `lab.students`, `lab.compute` (GPU tier 0–5), `lab.talent` (avg quality), `lab.progress`, `pi.papers`.
- **Automatic production**: every month the lab adds `floor(students * 3 * (1+compute*0.18) * clip(morale/60,0.4,1.4) * clip(talent,0.7,1.5))` to `lab.progress`. More/better-resourced students = faster papers. This runs regardless of your action.
- **7 monthly actions** (some conditional via `requirement`): Crunch (deadline-boosted), Mentor, Write Grant, Network, Protect work-life, **Buy GPUs** (spend funding → compute), Polish (acceptance buff). Your action shapes the lab on top of its baseline output.
- **Yearly recruiting** (Years 2–6): Strong PhD (needs rep≥32) / Regular PhD / Postdoc (costly) / none — gated by funding via `requirement`. Headcount raises monthly stipend burn but boosts production. *Reputation wins bigger grants, so growth funds itself.*
- **Funding as a budget**: monthly burn = `students*stipend(2) + compute − 3` (institutional support). Grant size scales with reputation.
- **Paper pipeline**: `progress≥100` → submit one; accept ≈ `clip(0.42 + rep/200 + buff + compute*0.03, …)`; spotlight bonus on a hit; reject refunds ~45 progress.
- **Deadline calendar**: months 1/5/9 set `deadlineCrunch` (Crunch hits harder, morale burns faster).
- **Retention**: morale <30 risks a student quitting; `students≤0` ends the game.
- **Endings**: morale=0 implode; funding=0 bankrupt; lab empty; Year-7 tenure review → dream (`papers≥10 && rep≥55`) / borderline (`papers≥6`) / denied.
- **5 event cards**: Reviewer 2, industry offer, cluster outage, windfall (+ deadline season).

### Tuning (verified by a 400-run Monte-Carlo of the monthly loop, `/tmp/advsim.js`)
Near-optimal cautious play: ~100% survive, ~99% tenure, **~55% dream**. Growth play: ~68% survive (riskier), **~66% dream**, more papers. Casual play does worse. Knobs live in `Init` (`rule.*`, starting values), the production/acceptance expressions, and `status.yaml` drains.

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
