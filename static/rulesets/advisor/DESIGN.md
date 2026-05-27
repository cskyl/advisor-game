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

## Current vertical slice (what's implemented)
- **3 resources**: `lab.morale`, `pi.funding`, `pi.reputation` (0–100). Plus `pi.papers`, `pi.paperProgress`.
- **Monthly loop**: each month upkeep burns funding+morale, then you pick 1 of 5 actions (Push / Mentor / Grant / Network / Rest).
- **Paper pipeline**: progress→100 auto-submits; accept odds = `0.30 + reputation/250 + rebuttal buff`.
- **Endings**: morale=0 → lab implodes; funding=0 → bankrupt; Year 7 tenure review (papers + reputation gate).
- **4 event cards**: Reviewer 2, industry offer, cluster outage, windfall.

## Engine vocabulary (cheat sheet)
- **Triggers**: `Initialization`, `Tick`, `MonthBegin`, `YearBegin` (custom ones via `TriggerEvents`).
- **Event fields**: `trigger`, `once`, `probability`, `conditions` (`{id: Expression, expression: ...}`), `exclusions`, `actions`.
- **Actions**: `UpdateVariables`, `UpdateVariableLimits`, `SetStatus`, `GiveItem`, `DisplayMessage`,
  `DisplayChoices`, `Random` (groups+`weight`), `Switch` (every branch needs a `condition`; use `condition: 1` for default), `TriggerEvents`, `EndGame`.
- **Expressions**: `+ - * / %`, `===`, `&&`, `||`, `randi(n)` (0..n-1), `floor()`,
  `getAttributeValue('id')`, `hasStatus('id')`.

## Next design steps (suggested)
1. **Students as items/variables** — give each a hidden ability/morale, so Mentor/Push hit individuals, not a global bar. The biggest upgrade over the PhD sim.
2. **Advisor archetypes** — opening choice that sets attribute baselines (点子王 / 连接者 / 盾牌 / 机器).
3. **More event cards** — this is where flavor + replayability live; cards are cheap to add.
4. **Deadline calendar** — set `deadlineCrunch` status in specific months (ICML Jan, NeurIPS May) to create a rhythm.
5. **Tune numbers** — `rule.papersForTenure`, acceptance formula, monthly burn in `attributes.yaml`.
