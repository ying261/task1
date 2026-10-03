import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('config', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('rejects the known dev default secret', async () => {
    vi.stubEnv('JWT_SECRET', 'change-me')
    await expect(import('../src/config')).rejects.toThrow(/JWT_SECRET/)
  })

  it('rejects an empty secret', async () => {
    vi.stubEnv('JWT_SECRET', '')
    await expect(import('../src/config')).rejects.toThrow(/JWT_SECRET/)
  })

  it('accepts a custom secret', async () => {
    vi.stubEnv('JWT_SECRET', 'custom-secret')
    const cfg = await import('../src/config')
    expect(cfg.JWT_SECRET).toBe('custom-secret')
  })
})
