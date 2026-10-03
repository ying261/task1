import { describe, it, expect } from 'vitest'
import { prisma } from '../src/lib/prisma'

describe('schema + seed', () => {
  it('seeds an admin and regular users', async () => {
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } })
    const alice = await prisma.user.findUnique({ where: { username: 'alice' } })
    expect(admin?.role).toBe('ADMIN')
    expect(alice?.role).toBe('USER')
  })
})
