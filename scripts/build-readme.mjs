// Assemble README.md from docs/star/*.md, so no drafter ever writes README.md
// directly. Idempotent: the same sections always produce the same README.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ORDER = ['header', 'eli5', 'situation', 'task-action', 'result', 'glossary', 'sources']

const parts = ORDER.map((name) => `docs/star/${name}.md`)
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, 'utf8').trim())

writeFileSync('README.md', parts.join('\n\n') + '\n')
console.log(`README.md assembled from ${parts.length} section(s)`)
