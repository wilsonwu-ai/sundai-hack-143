import { expect, test } from '@playwright/test'

test('app start screen renders, fits the screen, and has no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('./')
  await expect(page).toHaveTitle(/Movement Age/)
  await expect(page.getByRole('heading', { level: 1, name: /Movement Age/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /start/i })).toBeVisible()
  await expect(page.locator('a[href*="explainer"]').first()).toBeVisible()
  await expect(page.getByRole('img', { name: /chair stand/i }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: /one-leg stand/i }).first()).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})
