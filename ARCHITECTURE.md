# Advisor Simulator — Architecture & Maintenance Guide

> Read this first if you're picking up the project (human or AI agent). It explains
> how the game is built, where everything lives, how to change it safely, and the
> non-obvious invariants that will bite you. For *game design* (mechanics, numbers,
> intent) see [`static/rulesets/advisor/DESIGN.md`](static/rulesets/advisor/DESIGN.md).

## 1. What this is, in one paragraph

A bilingual (EN/中文), text-based web game where you play a new AI assistant
professor running a lab and chasing tenure. It is built on the **phd-game** engine
by Mianzhi Wang (MIT). **We did not modify the engine.** Everything that makes this
"the advisor game" is *data*: a set of YAML files in `static/rulesets/advisor/`,
selected by a JSON config block in `static/index.html`. If you understand the engine's
data model (§4) you can build the entire game without touching a line of TypeScript.

## 2. Repo layout

```
advisor-game/
├── src/                      # The phd-game ENGINE (TypeScript). DO NOT EDIT.
│   ├── gameEngine.ts         #   registers actions/conditions; game loop
│   ├── event/                #   event engine, actions, conditions, expressions
│   ├── effect/               #   attributes, items, statuses
│   └── gui/                  #   renders stats bar, message window, modals
├── static/
│   ├── index.html            # app_config JSON -> points engine at a ruleset
│   ├── css/, images/
│   └── rulesets/
│       ├── advisor/          # <<< THE GAME. All gameplay lives here.
│       │   ├── events.yaml   #   all logic: loop, actions, papers, endings, cards
│       │   ├── attributes.yaml, items.yaml, status.yaml
│       │   ├── gui.yaml      #   which meters/buttons show
│       │   ├── lang.en.yaml, lang.zh.yaml   # every string
│       │   └── DESIGN.md     #   game-design notes + engine cheat sheet
│       └── default/          # original PhD-student ruleset, kept as reference
├── tools/
│   ├── validate.js           # static checks (run before build; gates `npm build`)
│   └── balance_sim.js        # Monte-Carlo balance model (see §7)
├── dist/                     # build output (gitignored)
├── .github/workflows/deploy.yml   # auto-deploys to GitHub Pages on push
├── README.md, ARCHITECTURE.md (this file)
```

Sibling project `../phd-game/` is the **original** PhD-student simulator (same engine,
different ruleset). The two are independent git repos; changes here do not affect it.

## 3. Build, run, deploy

Node 20 is required. On the BU SCC, `npm` is **not** on the default PATH — Node lives at
`/share/pkg.8/nodejs/20.12.2/install/bin` (or `module load nodejs/20.12.2`, but the
module function may be missing in non-login shells, so prepending that bin dir is the
reliable move):

```bash
export PATH=/share/pkg.8/nodejs/20.12.2/install/bin:$PATH
npm install            # first time. If node_modules looks broken, rm -rf and reinstall.
npm run validate       # static checks (also runs automatically before build)
npm run build          # webpack -> dist/  (prebuild runs validate)
npm start              # serves dist/ at http://localhost:8000
npm run sim            # print balance Monte-Carlo (see §7)
```

**Deploy:** push to `master`. `.github/workflows/deploy.yml` builds and publishes to
https://cskyl.github.io/advisor-game/ . (Pushing is the only deploy step.)

**Switching games locally:** `static/index.html`'s `app_config` points every path at
`rulesets/advisor/`. Point them at `rulesets/default/` to run the original PhD sim.

## 4. The engine's data model (what you actually program in)

The engine is an interpreter for YAML. Five concepts:

- **Variables** — a flat namespace of **numbers only** (no strings, arrays, or objects).
  Names are dotted for readability (`lab.morale`, `pi.funding`) but the dots are not
  structure. Set with `UpdateVariables`; optionally bounded with `UpdateVariableLimits`.
- **Events** — the unit of logic. Fields:
  `id`, `trigger`, `once` (fire at most once), `probability` (0..1 or expr),
  `conditions` (list of `{id: Expression, expression: "..."}`, all must pass),
  `exclusions` (ids to suppress this tick), `actions`.
- **Triggers** — `Initialization` (boot), `Tick` (every engine step), `MonthBegin`,
  `YearBegin`. Custom triggers are fired via the `TriggerEvents` action.
  **Within one trigger, events run in YAML definition order** (engine iterates the list).
  This is how sequencing works — see §5.
- **Actions** — the verbs. The ones this game uses:
  `UpdateVariables` / `UpdateVariableLimits`, `SetStatus`, `GiveItem`,
  `DisplayMessage`, `DisplayChoices`, `Random`, `Switch`, `Loop`, `TriggerEvents`,
  `EndGame`. (Full list is registered in `src/gameEngine.ts` ~line 215.)
- **Expressions** — JS-like, compiled by the engine. Operators `+ - * / %`, `===`,
  `&& || !`, comparisons. Functions: `randi(n)` (0..n-1), `random()`, `floor/round/ceil`,
  `min/max`, `clip(x,lo,hi)`, `hasStatus('id')`, `getAttributeValue('id')`,
  `itemCount('id')`, `eventOccurred('id')`. **Booleans coerce to 1/0 in arithmetic**
  (e.g. `hasStatus('deadlineCrunch') * 16`). An expression that evaluates to `NaN`
  throws — so every variable you reference must be initialized first (see §8).

Supporting definitions:
- **attributes.yaml** — hidden numeric "stats" that statuses modify; read via
  `getAttributeValue`. Used here for `pi.moraleDrain`, `pi.paperAcceptanceBoost`.
- **status.yaml** — timed/permanent buffs/debuffs; each can carry `attributeModifiers`.
- **items.yaml** — things shown in the right-hand "Lab" panel (badges/trophies).
- **gui.yaml** — which meters appear in the stats bar, and the footer buttons.
- **lang.\*.yaml** — every player-visible string, keyed. `{{var}}` interpolates a game
  variable; `**markdown**` works. EN and ZH must define the same keys.

Action sub-shapes worth memorizing:
- `Switch`: `branches: [{condition, actions}]`. **Every branch needs a condition**;
  there is no default branch — use `condition: 1` as the final catch-all.
- `Random`: `groups: [{weight, actions}]`. Weights may be expressions; they're
  normalized, so for a probability `p` use `weight: p` and `weight: 1 - p`.
- `DisplayChoices`: `choices: [{message, requirement?, actions}]`. A choice with a
  `requirement` expression only appears when it's true (used to hide unaffordable options).
- `Loop`: `{stopCondition, maxIterations, actions}`. It's a **while-loop** (checks
  `stopCondition` *before* each iteration). Keep the body **synchronous** — no
  `DisplayMessage`/`DisplayChoices` inside, or the loop won't run to completion.

## 5. The monthly loop (the single most important thing to understand)

`GameTick` advances `elapsedMonth/month/year`, fires `YearBegin` (on month 1) then
`MonthBegin`. All `MonthBegin` events then run **in the order they appear in
`events.yaml`**, which is deliberately:

```
TheBeginning (once)           opening choice
ConferenceOpens               [deadline months] announce venue, set conf.*, crunch mood
MonthlyUpkeep                 funding -= stipends+GPU-support ; morale -= drain
Lab{Implodes,Bankrupt,Empty}  lose checks
StudentQuits                  morale<30 -> maybe lose a student
MonthlyAction                 THE player choice (1 of 7) — blocks for input
ResearchProduction            lab adds to lab.progress (auto, scales w/ lab)
ConferenceSubmit              [deadline months] batch-submit all ready drafts
Ev* cards                     Reviewer2 / industry offer / outage / windfall
YearBegin events: TenureClockStarts(y4), RecruitDecision(y2-6), TenureReview(y7)
```

Ordering invariants you must preserve when adding events:
- `ConferenceOpens` runs **before** `MonthlyAction` (so "Crunch" sees `deadlineCrunch`)
  and `ConferenceSubmit` runs **after** `ResearchProduction` (so this month's output
  is submittable). The two conference events must share the same month list
  (`validate.js` enforces this).
- Lose-checks read state right after upkeep; that's intentional.

## 6. Game systems → where they live in `events.yaml`

| System | Event(s) | Notes |
|---|---|---|
| Boot / starting values | `Init` | all `rule.*`, starting resources, var limits |
| Clock | `GameTick` | month/year math |
| Conferences | `ConferenceOpens`, `ConferenceSubmit` | calendar = months 2/5/8/11; per-venue `conf.accMod`/`conf.prestige` |
| Paper production | `ResearchProduction` | `floor(students * 6 * (1+compute*0.2) * f(morale) * f(talent))` |
| Submission/verdict | `ConferenceSubmit` | banks `progress`→`draftsReady`; a `Loop` reviews each; reject refunds ~45 |
| Monthly actions (7) | `MonthlyAction` | crunch/mentor/grant/network/rest/buy-GPU/polish |
| Recruiting (yearly) | `RecruitDecision` | strong/regular/postdoc/none; `requirement`-gated |
| Economy | `MonthlyUpkeep` + grant action | burn = students*stipend + compute − 2 |
| Retention | `StudentQuits`, `LabEmpty` | low morale risks losing students |
| Endings | `Lab*`, `TenureReview` | dream (≥14 papers & rep≥55) / tenure (≥5) / denied |
| Event cards | `Ev*` | cheap to add; pure flavor + small effects |

Key coupled relationships (these answer common "how does X affect Y" questions):
- **GPU tier (`lab.compute`)** boosts BOTH production (`ResearchProduction`) AND
  acceptance odds (`ConferenceSubmit` weight). It costs upkeep every month.
- **Reputation** is driven primarily by **accepted papers** (scaled by venue prestige).
  Networking's reputation gain is scaled by `pi.papers` (no papers → almost no gain),
  and bigger reputation wins bigger grants — so output, reputation, and funding form a
  virtuous loop you have to kick-start with papers.
- **Multiple papers per deadline** emerges from lab SIZE: deadlines are ~3 months apart,
  so a large/high-throughput lab banks several drafts and submits them together.

## 7. Balance methodology — `tools/balance_sim.js`

Difficulty is tuned with a **Monte-Carlo model of the monthly loop**, not by guessing.
It runs two policies ("steady" = no growth, "grow" = recruit when funded) for 400 games
and reports survival %, dream-ending %, tenure %, average papers, and multi-submission
frequency.

> ⚠️ **`balance_sim.js` is a SEPARATE re-implementation of the rules in JS.** It is NOT
> wired to the YAML. If you change a number in `events.yaml`, change the matching
> constant in `balance_sim.js` (the `P = {...}` block and the formulas), and vice-versa.
> They WILL drift if you forget; the sim is only trustworthy if you keep them mirrored.

Workflow for any balance change:
1. Edit `P`/formulas in `balance_sim.js`; `npm run sim` until the numbers feel right.
2. Mirror the exact constants into `events.yaml` (production line, `Init` `rule.*`,
   grant amounts, `conf.*`, `status.yaml` drains).
3. `npm run validate && npm run build`; sanity-play in the browser.

Current target (near-optimal play): cautious ≈97% survive / ~78% dream; growth ≈65%
survive (riskier) / multi-submits ~18% of deadlines. Casual play lands lower, but
tenure is reliable — that's the intended "approachable" feel.

## 8. Gotchas & invariants (the things that actually break)

- **Don't edit `src/`.** It's the upstream engine. All changes are YAML.
- **Initialize every variable in `Init`.** Referencing an unset variable yields `NaN`,
  which throws at runtime. New mechanic → new `Init` line.
- **`UpdateVariables` applies keys in order**, and later keys see earlier ones' new
  values (the clock relies on this). Order your updates accordingly.
- **`Switch` has no default** — end with `condition: 1`.
- **`Loop` bodies must be synchronous** (no message/choice actions inside) or the loop
  stalls. Accumulate counts in scratch vars (`tmp.*`) and show one summary after.
- **Conference month lists must match** between `ConferenceOpens` and `ConferenceSubmit`
  (validator checks). If you move a deadline, update both + the venue `Switch` + lang.
- **EN and ZH must define the same keys.** `validate.js` flags missing/unused; keep both
  files in lockstep when you add/rename a string.
- **Keep the sim in sync** (§7).
- **Showing computed numbers:** text only interpolates bare `{{variable}}` (no inline
  math). To display a derived value (monthly burn, GPU cost, funding runway, banked
  drafts) compute it into a `hud.*` variable in the `RecomputeDerived` event (run early
  each month) and reference `{{hud.x}}` in a string. If an action changes the inputs
  mid-month (e.g. buying a GPU bumps `lab.compute`), recompute the affected `hud.*` in
  that action too. Name them `hud.*`, not `ui.*` — `ui.*`/`msg.*` are reserved for
  translation keys and the validator treats them as such.
- **GitHub Pages base path:** the site is served from `/advisor-game/`. Asset paths in
  `index.html` are relative, so this works — don't switch them to absolute `/...`.

## 9. Pre-commit checklist

```bash
npm run validate          # 0 errors
npm run build             # compiles, copies ruleset into dist/
npm run sim               # if you touched any number, confirm the balance
# then open dist/ in a browser (npm start) and click through a few months
```

Then commit with a message that says *what changed and why* (the balance commits in the
log are good examples). Push to deploy.
