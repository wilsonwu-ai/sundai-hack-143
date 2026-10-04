import { describe, expect, it } from 'vitest'
import { chairStandDiagram, framingDiagram, oneLegStandDiagram } from '../../src/ui/diagrams'

const cases = [
  ['chairStandDiagram', chairStandDiagram, /chair stand/i],
  ['oneLegStandDiagram', oneLegStandDiagram, /one-leg stand/i],
  ['framingDiagram', framingDiagram, /shoulders to ankles/i],
] as const

describe('instruction diagrams', () => {
  for (const [name, diagram, label] of cases) {
    it(`${name} is an accessible, theme-aware SVG`, () => {
      const svg = diagram()
      expect(svg.trimStart().startsWith('<svg')).toBe(true)
      expect(svg).toMatch(/role="img"/)
      expect(svg).toMatch(/viewBox="[\d.\s-]+"/)
      const aria = svg.match(/aria-label="([^"]+)"/)
      expect(aria?.[1]).toMatch(label)
      const title = svg.match(/<title[^>]*>([^<]+)<\/title>/)
      expect(title?.[1]).toBe(aria?.[1])
      // Colours come from CSS custom properties only, so both themes work.
      expect(svg).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
      expect(svg).not.toMatch(/[–—]/)
    })
  }
})
