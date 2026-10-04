// Extract the explainer's diagrams as standalone SVG files for the README, so
// GitHub readers see the same pictures without leaving the repo. The explainer
// stays the single source: re-run this after editing research/explainer.html.
// Each SVG carries its own background card and colour tokens (light, and dark
// under prefers-color-scheme), so it stays legible on either GitHub theme.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('research/explainer.html', 'utf8')

function block(re, what) {
  const m = html.match(re)
  if (!m) throw new Error(`research/explainer.html: could not find ${what}`)
  return m[1]
}

const light = block(/:root\s*\{([\s\S]*?)\}/, 'the light :root tokens').replace(/color-scheme:\s*light;?/, '')
const dark = block(/:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\}/, 'the dark tokens').replace(/color-scheme:\s*dark;?/, '')
const paint = block(/\/\* svg paint classes \*\/([\s\S]*?)\n\.defs/, 'the svg paint classes')

// HTML named entities are undefined in standalone XML and would break the image.
const ENTITIES = { '&ne;': '≠', '&middot;': '·', '&nbsp;': ' ', '&times;': '×' }

const FIGURES = [
  ['hero-t', 'birthday-vs-body-clock'],
  ['age-t', 'same-odometer'],
  ['good-t', 'measure-twice'],
  ['bar-t', 'idea-ranking'],
  ['pick-t', 'movement-age'],
  ['dots-t', 'movement-age-scores'],
]
const PAD = 16

mkdirSync('docs/img', { recursive: true })
for (const [titleId, name] of FIGURES) {
  const m = html.match(new RegExp(`<svg viewBox="([^"]+)"[^>]*aria-labelledby="${titleId}[^"]*"[^>]*>([\\s\\S]*?)</svg>`))
  if (!m) throw new Error(`research/explainer.html: no svg labelled ${titleId}`)
  const [x, y, w, h] = m[1].trim().split(/\s+/).map(Number)
  let inner = m[2]
  for (const [entity, char] of Object.entries(ENTITIES)) inner = inner.split(entity).join(char)
  const stray = inner.match(/&(?!amp;|lt;|gt;|quot;|apos;|#)[a-z]+;/i)
  if (stray) throw new Error(`${name}: add ${stray[0]} to ENTITIES`)

  const W = w + 2 * PAD
  const H = h + 2 * PAD
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x - PAD} ${y - PAD} ${W} ${H}" width="${W * 2}" height="${H * 2}" role="img" aria-labelledby="${titleId}">
<style><![CDATA[
svg {${light}}
@media (prefers-color-scheme: dark) { svg {${dark}} }
.card { fill: var(--bg); stroke: var(--line); stroke-width: 1; }
${paint.trim()}
]]></style>
<rect class="card" x="${x - PAD + 0.5}" y="${y - PAD + 0.5}" width="${W - 1}" height="${H - 1}" rx="14"/>
${inner.trim()}
</svg>
`
  writeFileSync(`docs/img/${name}.svg`, svg)
}
console.log(`docs/img: ${FIGURES.length} diagrams extracted from the explainer`)
