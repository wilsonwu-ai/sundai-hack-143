import type { BalanceSummary, SummarizeBalance } from '../contracts'

const TEN_SECONDS_MS = 10000

export const summarizeBalance: SummarizeBalance = (heldMs: number): BalanceSummary => {
  const ms = Number.isFinite(heldMs) ? Math.max(0, heldMs) : 0
  return {
    heldSeconds: Math.round(ms / 100) / 10,
    passedTenSeconds: ms >= TEN_SECONDS_MS,
    context:
      'In 1,702 adults aged 51 to 75, not completing a 10-second one-leg stand was linked to higher all-cause mortality after adjusting for age, sex, BMI and other conditions (not studied under 51).',
    source: {
      id: 'F21',
      citation:
        'Araujo CG et al. Successful 10-second one-legged stance performance predicts survival in middle-aged and older individuals. Br J Sports Med 2022',
      url: 'https://pubmed.ncbi.nlm.nih.gov/35728834/',
      note: 'adults aged 51 to 75',
    },
  }
}
