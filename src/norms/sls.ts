import type { PlaceSls, Performance, SlsBand, SlsPlacement } from '../contracts'
import { SLS_MAX_MS } from '../contracts'
import sls from '../data/sls-norms.json'

interface LegTable {
  mean: number[]
  sd: number[]
  ciLow: number[]
  ciHigh: number[]
}

const BANDS = sls.bands as SlsBand[]

function averageLegs(a: LegTable, b: LegTable): LegTable {
  const avg = (x: number[], y: number[]): number[] => x.map((v, i) => (v + y[i]) / 2)
  return {
    mean: avg(a.mean, b.mean),
    sd: avg(a.sd, b.sd),
    ciLow: avg(a.ciLow, b.ciLow),
    ciHigh: avg(a.ciHigh, b.ciHigh),
  }
}

function bandIndexForAge(age: number): number | null {
  if (!(age >= 18)) return null
  if (age < 30) return 0
  if (age < 40) return 1
  if (age < 50) return 2
  if (age < 60) return 3
  if (age < 70) return 4
  return 5
}

function performanceFromZ(z: number): Performance {
  if (z < -2) return 'well-below'
  if (z < -1) return 'below'
  if (z <= 1) return 'typical'
  if (z <= 2) return 'above'
  return 'well-above'
}

export const placeSls: PlaceSls = (heldMs, liftedSide, age): SlsPlacement => {
  const heldSeconds = Math.round(heldMs / 100) / 10
  const capped = heldMs >= SLS_MAX_MS

  const stanceLeg: SlsPlacement['stanceLeg'] =
    liftedSide === 'left' ? 'right' : liftedSide === 'right' ? 'left' : 'either'

  const table: LegTable =
    stanceLeg === 'either'
      ? averageLegs(sls.legs.right, sls.legs.left)
      : sls.legs[stanceLeg]

  const bandIdx = bandIndexForAge(age)
  const ownBand: SlsBand | null = bandIdx === null ? null : BANDS[bandIdx]

  let performance: Performance | null = null
  if (bandIdx !== null) {
    const z = (heldSeconds - table.mean[bandIdx]) / table.sd[bandIdx]
    performance = performanceFromZ(z)
  }

  let matchesAverageOf: SlsBand[] = BANDS.filter(
    (_, i) => heldSeconds >= table.ciLow[i] && heldSeconds <= table.ciHigh[i],
  )
  if (matchesAverageOf.length === 0) {
    const dists = table.mean.map((m) => Math.abs(heldSeconds - m))
    const best = Math.min(...dists)
    matchesAverageOf = BANDS.filter((_, i) => dists[i] <= best + 1e-9)
  }

  const aboveAllBands = table.ciHigh.every((hi) => heldSeconds > hi)

  return {
    heldSeconds,
    capped,
    stanceLeg,
    ownBand,
    performance,
    matchesAverageOf,
    aboveAllBands,
    source: {
      id: sls.source.id,
      citation: sls.source.citation,
      url: sls.source.url,
      note: `${sls.source.population}. ${sls.source.protocol}.`,
    },
  }
}
