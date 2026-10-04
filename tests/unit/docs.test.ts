import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Public docs are checked in CI like code: no em or en dashes, and every
// [F##] citation must point at a finding that survived verification.
const ROOT = fileURLToPath(new URL('../../', import.meta.url))

function docFiles(): string[] {
  const files = ['README.md']
  for (const dir of ['docs/star', 'public/explainer']) {
    const abs = join(ROOT, dir)
    if (!existsSync(abs)) continue
    for (const f of readdirSync(abs)) if (/\.(md|html)$/.test(f)) files.push(join(dir, f))
  }
  return files.filter((f) => existsSync(join(ROOT, f)))
}

describe('public docs', () => {
  it('contain no em or en dashes', () => {
    const bad: string[] = []
    for (const f of docFiles()) {
      readFileSync(join(ROOT, f), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/[–—]/.test(line)) bad.push(`${f}:${i + 1}`)
        })
    }
    expect(bad).toEqual([])
  })

  it('cite only findings that survived verification', () => {
    const verifiedPath = join(ROOT, 'research/verified.json')
    if (!existsSync(verifiedPath)) return
    const { findings } = JSON.parse(readFileSync(verifiedPath, 'utf8')) as {
      findings: { id: string; status: string }[]
    }
    const citable = new Set(findings.filter((f) => f.status !== 'killed').map((f) => f.id))
    const unknown: string[] = []
    for (const f of docFiles()) {
      for (const m of readFileSync(join(ROOT, f), 'utf8').matchAll(/\[(F\d{2,3})\]/g)) {
        if (!citable.has(m[1])) unknown.push(`${f}: ${m[1]}`)
      }
    }
    expect(unknown).toEqual([])
  })
})
