import { expect, test } from '@playwright/test'

// The explainer is read on a phone at the venue: it must load clean and never
// scroll sideways.
test('explainer renders, has no console errors, and fits the screen', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('./explainer/')
  await expect(page.locator('h1').first()).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})
