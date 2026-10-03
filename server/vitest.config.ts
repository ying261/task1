import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    env: { DATABASE_URL: 'file:./test.db', JWT_SECRET: 'test-secret' },
    setupFiles: ['./tests/setup.ts'],
  },
})
