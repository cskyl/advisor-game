# CLAUDE.md — orientation for AI agents

This is **Advisor Simulator**, a data-driven web game built on the unmodified **phd-game**
engine. **Read [ARCHITECTURE.md](ARCHITECTURE.md) before making changes** — it has the
engine model, the monthly loop, how-to-extend recipes, and the invariants. This file is
the 60-second version.

## What you almost always change
The game is **YAML**, not code: `static/rulesets/advisor/*.yaml`.
- `events.yaml` — all game logic (the monthly loop, actions, papers, recruiting, endings, event cards)
- `lang.en.yaml` / `lang.zh.yaml` — every string (keep both in sync)
- `gui.yaml`, `status.yaml`, `attributes.yaml`, `items.yaml` — UI meters, buffs, stats, badges

## What you must NOT do
- **Don't edit `src/`** — it's the upstream engine. Everything is achievable in YAML.
- **Don't let the balance sim drift.** `tools/balance_sim.js` is a *separate* JS model of
  the rules. If you change a gameplay number in `events.yaml`, change it in the sim too
  (and vice-versa), then `npm run sim`.

## Hard rules the engine imposes (these cause runtime errors if violated)
- Variables are **numbers only**; **initialize every variable in the `Init` event** or
  expressions referencing it throw `NaN`.
- `Switch` needs a condition on every branch — use `condition: 1` as the catch-all.
- `Loop` bodies must be **synchronous** (no `DisplayMessage`/`DisplayChoices` inside).
- `ConferenceOpens` and `ConferenceSubmit` must list the **same months** (validator checks).
- EN and ZH lang files must define the **same keys**.

## Workflow
```bash
export PATH=/share/pkg.8/nodejs/20.12.2/install/bin:$PATH   # BU SCC: npm isn't on default PATH
npm run validate     # static checks (also runs before build)
npm run build        # webpack -> dist/
npm run sim          # balance Monte-Carlo (run if you touched any number)
npm start            # serve dist/ at :8000, then click through a few in-game months
```
Commit with a clear "what + why" message; push `master` to deploy to GitHub Pages.

## Project memory
The maintainer's running notes live in the user's Claude memory under
`project-advisor-game` (path, status, gotchas). Keep it updated when the game changes
materially.
