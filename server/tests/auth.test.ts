import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { app } from '../src/app'

describe('auth', () => {
  it('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'carol', password: 'secret123' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ username: 'carol', role: 'USER' })
  })
  it('establishes a working session on register', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'dave', password: 'secret123' })
    expect(res.status).toBe(201)
    const cookie = res.headers['set-cookie']?.[0]
    expect(cookie).toMatch(/token=/)
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(me.status).toBe(200)
    expect(me.body.username).toBe('dave')
  })
  it('rejects duplicate username', async () => {
    await request(app).post('/api/auth/register').send({ username: 'carol', password: 'secret123' })
    const res = await request(app).post('/api/auth/register').send({ username: 'carol', password: 'secret123' })
    expect(res.status).toBe(409)
  })
  it('logs in with correct credentials and sets cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.username).toBe('alice')
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=/)
  })
  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'nope' })
    expect(res.status).toBe(401)
  })
  it('returns current user from /me', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' })
    const cookie = login.headers['set-cookie'][0]
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.username).toBe('alice')
  })
  it('returns 401 for /me without cookie', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})
