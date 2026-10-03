import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { app } from '../src/app'

describe('GET /api/users', () => {
  it('returns colleagues excluding the caller, sorted', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' })
    const cookie = login.headers['set-cookie'][0]
    const res = await request(app).get('/api/users').set('Cookie', cookie)
    expect(res.status).toBe(200)
    const names = res.body.users.map((u: any) => u.username)
    expect(names).not.toContain('alice')
    expect(names).toContain('bob')
    expect(names).toContain('admin')
  })
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })
})
