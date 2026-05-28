# 导师模拟器 / Advisor Simulator

A random-event-driven, text-based web game where you play a brand-new **AI assistant
professor** running a lab and chasing **tenure** — while trying not to burn out your
students. You juggle three meters — **Lab Morale**, **Funding**, **Reputation** — grow
a lab, buy GPUs, write grants, and submit batches of papers to ICML / NeurIPS / AAAI /
CVPR. Bilingual (English / 中文).

🎮 **Play:** https://cskyl.github.io/advisor-game/

Built on the **phd-game** engine by [Mianzhi Wang](https://github.com/morriswmz/phd-game)
(MIT). The engine in `src/` is unchanged — the entire game is data, in the YAML under
`static/rulesets/advisor/`.

## Quick start

```bash
# Node 20 required. On BU SCC: export PATH=/share/pkg.8/nodejs/20.12.2/install/bin:$PATH
npm install                 # first time
npm run build && npm start  # build (runs validation first) and serve at :8000
npm run sim                 # print the balance Monte-Carlo
```

Push to `master` to deploy (GitHub Pages, via `.github/workflows/deploy.yml`).

## Gameplay

The lab produces research automatically each month (faster with more students, better
GPUs, higher morale). It banks into **drafts**; at each conference deadline you submit
*all* ready drafts to that venue at once — so a bigger lab lands more papers. Each month
you pick one focus (crunch / mentor / grant / network / rest / buy GPUs / polish); each
year you decide whether to recruit. Reach the **Year-7 tenure review**: a few papers
earns tenure, while **14 papers + reputation ≥ 55** earns the *dream* ending. Let Morale
or Funding hit zero and the lab collapses.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — start here to maintain or extend the game:
  engine data model, the monthly event loop, how to add content, balance methodology,
  and the invariants that will bite you.
- **[static/rulesets/advisor/DESIGN.md](static/rulesets/advisor/DESIGN.md)** — game
  design: mechanics, current numbers, the engine cheat sheet, and planned next steps.
- **[CLAUDE.md](CLAUDE.md)** — orientation for AI coding agents.

## License

MIT (engine © Mianzhi Wang; advisor ruleset and docs added on top).
