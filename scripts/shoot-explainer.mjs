// Screenshot the top of the picture explainer in light and dark for the README
// preview card. Run after scripts/wrap-explainer.mjs.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const url = pathToFileURL(resolve('public/explainer/index.html')).href
const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 680 }, colorScheme: scheme, deviceScaleFactor: 1.5 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `docs/img/explainer-preview-${scheme}.png` })
  await page.close()
}
await browser.close()
console.log('docs/img: explainer previews captured (light, dark)')
