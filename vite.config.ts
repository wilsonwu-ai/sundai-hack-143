import { defineConfig } from 'vitest/config'

// GitHub Pages serves this repo under /sundai-hack-143/.
export default defineConfig({
  base: '/sundai-hack-143/',
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
