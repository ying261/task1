import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { app } from '../src/app'

describe('error handling', () => {
  it('returns 404 JSON for unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toHaveProperty('code')
    expect(res.body.error).toHaveProperty('message')
  })
  it('maps an ApiError to its status and shape', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'alice' })
    expect(res.status).toBe(400)
    expect(res.body.error).toHaveProperty('message')
  })
})
