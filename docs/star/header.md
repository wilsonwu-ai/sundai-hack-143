# Sundai Hack 143, explained: Biomarkers of Aging

[![ci-cd](https://github.com/wilsonwu-ai/sundai-hack-143/actions/workflows/ci.yml/badge.svg)](https://github.com/wilsonwu-ai/sundai-hack-143/actions/workflows/ci.yml)

**Live site:** https://wilsonwu-ai.github.io/sundai-hack-143/ (the demo ships there during the hack, 4 Oct 2026)

A STAR write-up of Sundai Hack 143 at the Harvard Innovation Lab: the **Situation** (what the hack asked, and what a biomarker of aging is), the **Task and Action** (every candidate approach, and why we chose ours), and the **Result** (what we built and deployed).

## Start here: the picture explainer

**[Open the picture explainer](https://wilsonwu-ai.github.io/sundai-hack-143/explainer/)**: the whole hack in big pictures and few words, built to read on a phone. What the hack asks, what wins the vote, the ideas ranked, why we picked Movement Age, and the pitch.

<a href="https://wilsonwu-ai.github.io/sundai-hack-143/explainer/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/img/explainer-preview-dark.png">
    <img src="docs/img/explainer-preview-light.png" alt="The picture explainer: a birthday clock beside a body clock, under the question of how to measure how fast someone is aging" width="760">
  </picture>
</a>

The same page is in this repo at [`research/explainer.html`](research/explainer.html) (source) and [`public/explainer/`](public/explainer/) (what GitHub Pages serves). The diagrams below are extracted from it by [`scripts/extract-diagrams.mjs`](scripts/extract-diagrams.mjs), so the page and this README never drift apart.

Every number in this repo cites a finding ID like [F21]. Findings live in `research/verified.json` with their source URL, publication date and how they were checked.
