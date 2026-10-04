import { describe, expect, it } from 'vitest'
import { SLS_MAX_MS } from '../../src/contracts'
import sls from '../../src/data/sls-norms.json'
import { placeSls } from '../../src/norms/sls'

describe('single-leg stance data, anchored to F61 Table 2', () => {
  it('matches values read off the source table (PMC9422043, 2026-10-04)', () => {
    expect(sls.bands).toEqual(['18-29', '30-39', '40-49', '50-59', '60-69', '70+'])
    expect(sls.n).toEqual([40, 40, 40, 40, 40, 40])
    expect(sls.legs.right.mean).toEqual([56.4, 47.0, 49.9, 50.0, 35.0, 14.6])
    expect(sls.legs.left.sd).toEqual([8.69, 15.4, 15.4, 18.0, 22.5, 16.7])
    expect(sls.legs.right.ciHigh).toEqual([59.2, 52.2, 55.3, 55.5, 42.0, 20.0])
    expect(sls.legs.left.ciLow).toEqual([53.9, 41.6, 46.2, 42.3, 23.2, 8.0])
    expect(SLS_MAX_MS).toBe(60000)
  })
})

describe('placeSls', () => {
  it('places a full 60-second hold above every band average', () => {
    const p = placeSls(60000, 'left', 25)
    expect(p.stanceLeg).toBe('right')
    expect(p.heldSeconds).toBe(60)
    expect(p.capped).toBe(true)
    expect(p.ownBand).toBe('18-29')
    expect(p.performance).toBe('typical')
    expect(p.matchesAverageOf).toEqual(['18-29'])
    expect(p.aboveAllBands).toBe(true)
    expect(p.source.id).toBe('F61')
  })

  it('finds every band whose average range contains the hold', () => {
    const p = placeSls(50000, 'right', 45)
    expect(p.stanceLeg).toBe('left')
    expect(p.capped).toBe(false)
    expect(p.ownBand).toBe('40-49')
    expect(p.performance).toBe('typical')
    expect(p.matchesAverageOf).toEqual(['30-39', '40-49', '50-59'])
    expect(p.aboveAllBands).toBe(false)
  })

  it('places an older adult on the 70 and over band', () => {
    const p = placeSls(12000, 'left', 72)
    expect(p.ownBand).toBe('70+')
    expect(p.performance).toBe('typical')
    expect(p.matchesAverageOf).toEqual(['70+'])
  })

  it('falls back to the nearest average and flags a very short hold', () => {
    const p = placeSls(5000, 'left', 25)
    expect(p.performance).toBe('well-below')
    expect(p.matchesAverageOf).toEqual(['70+'])
    expect(p.aboveAllBands).toBe(false)
  })

  it('averages both legs when the lifted side is unknown', () => {
    const p = placeSls(30000, null, 65)
    expect(p.stanceLeg).toBe('either')
    expect(p.ownBand).toBe('60-69')
    expect(p.performance).toBe('typical')
    expect(p.matchesAverageOf).toEqual(['60-69'])
  })

  it('handles ages outside the bands', () => {
    expect(placeSls(30000, 'left', 17).ownBand).toBeNull()
    expect(placeSls(30000, 'left', 17).performance).toBeNull()
    expect(placeSls(30000, 'left', 95).ownBand).toBe('70+')
  })
})
