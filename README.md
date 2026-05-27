# 导师模拟器 / Advisor Simulator

A random-event-driven, text-based game where you play a brand-new **AI assistant
professor** running a lab and chasing **tenure** — while trying not to burn out
your students. You juggle three meters: **Lab Morale**, **Funding**, and
**Reputation**. Bilingual (English / 中文).

Built on the **phd-game** engine by [Mianzhi Wang](https://github.com/morriswmz/phd-game)
(MIT License). The engine in `src/` is unchanged; the game is defined entirely by
the YAML rulesets in `static/rulesets/advisor/`. The original PhD-student ruleset
is kept in `static/rulesets/default/` as a reference for event patterns.

## Build and play locally

```bash
module load nodejs/20.12.2     # on BU SCC; otherwise have Node 20 on PATH
npm install                    # first time only
npm run build && npm start     # -> http://localhost:8000
```

## Gameplay

Each month you choose **one** focus: push the lab toward a deadline, mentor your
students, write a grant, network, or protect work-life balance. Paper progress
fills to 100% and auto-submits; your **Reputation** improves the odds against
**Reviewer 2**. Survive to the **tenure review at the start of Year 7** with
enough accepted papers — without letting Morale or Funding hit zero.

## Designing / modding

Everything is data. See **`static/rulesets/advisor/DESIGN.md`** for the engine
vocabulary cheat sheet, the current vertical slice, and the planned next steps.

## License

MIT
