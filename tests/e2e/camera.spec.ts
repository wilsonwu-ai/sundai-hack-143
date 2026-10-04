import { expect, test } from '@playwright/test'

// Integration check with the real pose model: Chromium's fake camera shows a
// test pattern with no person in it, so once MediaPipe has loaded and is reading
// frames, the app must ask the person to step into view.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
})

test('camera screen loads the pose model and asks the person to step into view', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one browser is enough for the model download')
  test.setTimeout(120_000)
  const crashes: string[] = []
  page.on('pageerror', (e) => crashes.push(e.message))

  await page.goto('./')
  await page.getByLabel(/age/i).fill('35')
  await page.getByLabel(/^female$/i).check()
  await page.getByRole('button', { name: /start/i }).click()

  await expect(page.locator('video')).toBeVisible()
  await expect(page.getByText(/step into view/i)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('img', { name: /shoulders to ankles/i })).toBeVisible()
  expect(crashes).toEqual([])
})
