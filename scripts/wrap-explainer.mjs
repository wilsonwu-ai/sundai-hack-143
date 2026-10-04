// The explainer is authored once as an Artifact page (title, style and content, no
// document skeleton). GitHub Pages needs a full document, so wrap it here and hoist
// the head elements. Idempotent.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('research/explainer.html', 'utf8')
const head = []
const body = src.replace(/<title>[\s\S]*?<\/title>|<style>[\s\S]*?<\/style>|<link\b[^>]*>|<meta\b[^>]*>/g, (m) => {
  head.push(m)
  return ''
})

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
${head.join('\n')}
</head>
<body>
${body.trim()}
</body>
</html>
`

mkdirSync('public/explainer', { recursive: true })
writeFileSync('public/explainer/index.html', page)
console.log(`public/explainer/index.html written (${head.length} head element(s) hoisted)`)
