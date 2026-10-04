import norms from '../data/sts-norms.json'
import type {
  AgeBand,
  PlaceSts,
  Performance,
  Sex,
  StsPlacement,
  StsTest,
  TableRange,
} from '../contracts'

const BANDS = norms.bands as AgeBand[]

/** Inclusive lower edge of each band, aligned to BANDS. */
const BAND_STARTS = [18, 30, 40, 50, 60, 70]
const MAX_AGE = 80

const RANGES: TableRange[] = ['<p2.5', 'p2.5-p25', 'p25-p50', 'p50-p75', 'p75-p97.5', '>p97.5']

/** Performance for reps (higher is better), per the contract: p25-p50 and p50-p75 both read as typical. */
const PERFORMANCE_FOR_REPS: Record<TableRange, Performance> = {
  '<p2.5': 'well-below',
  'p2.5-p25': 'below',
  'p25-p50': 'typical',
  'p50-p75': 'typical',
  'p75-p97.5': 'above',
  '>p97.5': 'well-above',
}

/** For 5rep seconds (lower is better) the mapping is reversed. */
const PERFORMANCE_FOR_SECONDS: Record<TableRange, Performance> = {
  '<p2.5': 'well-above',
  'p2.5-p25': 'above',
  'p25-p50': 'typical',
  'p50-p75': 'typical',
  'p75-p97.5': 'below',
  '>p97.5': 'well-below',
}

// Tolerance so that float noise in |median - value| cannot break a true tie.
const EPS = 1e-9

function bandIndexForAge(age: number): number {
  if (!Number.isFinite(age) || age < BAND_STARTS[0] || age > MAX_AGE) return -1
  let idx = 0
  for (let i = 0; i < BAND_STARTS.length; i++) {
    if (age >= BAND_STARTS[i]) idx = i
  }
  return idx
}

function rangeFor(v: number, p025: number, p25: number, p50: number, p75: number, p975: number): TableRange {
  if (v < p025) return RANGES[0]
  if (v < p25) return RANGES[1]
  if (v < p50) return RANGES[2]
  if (v < p75) return RANGES[3]
  if (v <= p975) return RANGES[4]
  return RANGES[5]
}

function typicalBands(medians: number[], value: number): AgeBand[] {
  let best = Infinity
  for (const m of medians) {
    const d = Math.abs(m - value)
    if (d < best) best = d
  }
  const out: AgeBand[] = []
  medians.forEach((m, i) => {
    if (Math.abs(m - value) <= best + EPS) out.push(BANDS[i])
  })
  return out
}

export const placeSts: PlaceSts = (test: StsTest, value: number, sex: Sex, age: number): StsPlacement => {
  const table = norms.tests[test]
  const cols = table[sex]

  const bandIdx = bandIndexForAge(age)
  let ownBand: AgeBand | null = null
  let tableRange: TableRange | null = null
  let performance: Performance | null = null

  if (bandIdx >= 0) {
    ownBand = BANDS[bandIdx]
    tableRange = rangeFor(
      value,
      cols['p2.5'][bandIdx],
      cols.p25[bandIdx],
      cols.p50[bandIdx],
      cols.p75[bandIdx],
      cols['p97.5'][bandIdx],
    )
    performance =
      table.better === 'lower' ? PERFORMANCE_FOR_SECONDS[tableRange] : PERFORMANCE_FOR_REPS[tableRange]
  }

  return {
    test,
    value,
    sex,
    age,
    ownBand,
    tableRange,
    performance,
    typicalOf: typicalBands(cols.p50, value),
    source: {
      id: norms.source.id,
      citation: norms.source.citation,
      url: norms.source.url,
      note: `${norms.source.population}. ${norms.source.protocol}`,
    },
  }
}
