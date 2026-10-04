import { describe, expect, it } from 'vitest'
import norms from '../../src/data/sts-norms.json'
import { summarizeBalance } from '../../src/norms/balance'
import { placeSts } from '../../src/norms/sts'

describe('reference data, anchored to F23 Table 2', () => {
  it('matches values read off the source table (PMC13193711, 2026-10-04)', () => {
    expect(norms.bands).toEqual(['18-29', '30-39', '40-49', '50-59', '60-69', '70-80'])
    expect(norms.tests['30s'].female.p50).toEqual([20, 19, 17, 14, 13, 11])
    expect(norms.tests['30s'].male.p50).toEqual([23, 20, 20, 18, 15, 11])
    expect(norms.tests['5rep'].female.p50).toEqual([7.0, 7.9, 8.1, 11.0, 11.3, 11.3])
    expect(norms.tests['1min'].male['p97.5']).toEqual([66, 72, 67, 48, 34, 25])
  })
})

describe('placeSts', () => {
  it('places a typical 35-year-old man on the 30-second test', () => {
    const p = placeSts('30s', 20, 'male', 35)
    expect(p.ownBand).toBe('30-39')
    expect(p.tableRange).toBe('p50-p75')
    expect(p.performance).toBe('typical')
    expect(p.typicalOf).toEqual(['30-39', '40-49'])
    expect(p.source.id).toBe('F23')
  })

  it('treats fewer seconds as better on the 5-rep test', () => {
    const p = placeSts('5rep', 6.0, 'female', 45)
    expect(p.ownBand).toBe('40-49')
    expect(p.tableRange).toBe('p2.5-p25')
    expect(p.performance).toBe('above')
    expect(p.typicalOf).toEqual(['18-29'])
  })

  it('maps the extremes', () => {
    expect(placeSts('30s', 40, 'female', 25).performance).toBe('well-above')
    expect(placeSts('30s', 5, 'female', 25).performance).toBe('well-below')
    expect(placeSts('5rep', 20, 'male', 25).performance).toBe('well-below')
    expect(placeSts('5rep', 3.5, 'male', 25).performance).toBe('well-above')
  })

  it('puts a value equal to p97.5 in the p75-p97.5 range', () => {
    expect(placeSts('30s', 32, 'female', 25).tableRange).toBe('p75-p97.5')
  })

  it('uses the band edges', () => {
    expect(placeSts('30s', 20, 'female', 29.9).ownBand).toBe('18-29')
    expect(placeSts('30s', 20, 'female', 30).ownBand).toBe('30-39')
    expect(placeSts('30s', 20, 'female', 80).ownBand).toBe('70-80')
    expect(placeSts('30s', 20, 'female', 17).ownBand).toBeNull()
  })

  it('still finds typical bands when the age is outside the table', () => {
    const p = placeSts('30s', 15, 'female', 85)
    expect(p.ownBand).toBeNull()
    expect(p.tableRange).toBeNull()
    expect(p.performance).toBeNull()
    expect(p.typicalOf).toEqual(['50-59'])
  })
})

describe('summarizeBalance', () => {
  it('reports seconds and the 10-second mark with its scope', () => {
    const b = summarizeBalance(12345)
    expect(b.heldSeconds).toBe(12.3)
    expect(b.passedTenSeconds).toBe(true)
    expect(b.context).toMatch(/51 to 75/)
    expect(b.context).toMatch(/unverified/i)
    expect(b.source.id).toBe('F21')
    expect(summarizeBalance(9999).passedTenSeconds).toBe(false)
  })
})
