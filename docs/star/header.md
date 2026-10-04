# Movement Age

**How old do your legs move?** Your phone's camera counts your chair stands, then places your time on a published age table built from 393 adults aged 18 to 80 [F23]. It also times a one-leg stand: failing to hold one for 10 seconds was linked to higher all-cause mortality in adults aged 51 to 75 [F21]. Pose tracking runs in your browser, so nothing is uploaded.

**Try it now:** https://wilsonwu-ai.github.io/sundai-hack-143/

<a href="https://wilsonwu-ai.github.io/sundai-hack-143/"><img src="docs/img/qr-movement-age.svg" alt="QR code that opens the Movement Age app" width="150"></a>

[![ci-cd](https://github.com/wilsonwu-ai/sundai-hack-143/actions/workflows/ci.yml/badge.svg)](https://github.com/wilsonwu-ai/sundai-hack-143/actions/workflows/ci.yml)

Built in one day at **Sundai Hack 143, Biomarkers of Aging** (Harvard Innovation Lab, 4 Oct 2026). An estimate from published reference data: not a medical device, not a diagnosis.

## Start here: the picture explainer

**[Open the picture explainer](https://wilsonwu-ai.github.io/sundai-hack-143/explainer/)**: the whole hack in big pictures and few words, built to read on a phone. What the hack asks, what wins the vote, the ideas ranked, why we picked Movement Age, and the pitch.

<a href="https://wilsonwu-ai.github.io/sundai-hack-143/explainer/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/img/explainer-preview-dark.png">
    <img src="docs/img/explainer-preview-light.png" alt="The picture explainer: a birthday clock beside a body clock, under the question of how to measure how fast someone is aging" width="760">
  </picture>
</a>

The same page is in this repo at [`research/explainer.html`](research/explainer.html) (source) and [`public/explainer/`](public/explainer/) (what GitHub Pages serves). The diagrams below are extracted from it by [`scripts/extract-diagrams.mjs`](scripts/extract-diagrams.mjs), so the page and this README never drift apart.

The rest of this README is a STAR write-up: the **Situation** (what the hack asked, and what a biomarker of aging is), the **Task and Action** (every candidate approach, and why we chose ours), and the **Result** (what we built and deployed). Every number cites a finding ID like [F21]; findings live in `research/verified.json` with their source URL, publication date and how they were checked.
