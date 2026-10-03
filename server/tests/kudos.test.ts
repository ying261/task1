import request from 'supertest'
import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { resetRateLimit } from '../src/lib/rateLimit'

async function login(username: string) {
  const r = await request(app).post('/api/auth/login').send({ username, password: username === 'admin' ? 'admin123' : 'password123' })
  return r.headers['set-cookie'][0]
}
async function userId(name: string) {
  return (await prisma.user.findUnique({ where: { username: name } }))!.id
}

beforeEach(resetRateLimit)

describe('POST /api/kudos', () => {
  it('creates a kudos', async () => {
    const cookie = await login('alice')
    const bobId = await userId('bob')
    const res = await request(app).post('/api/kudos').set('Cookie', cookie)
      .send({ recipientId: bobId, message: 'Nice work!' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ message: 'Nice work!', recipient: { username: 'bob' } })
  })
  it('rejects empty message', async () => {
    const cookie = await login('alice')
    const bobId = await userId('bob')
    const res = await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: bobId, message: '' })
    expect(res.status).toBe(400)
  })
  it('rejects whitespace-only message', async () => {
    const cookie = await login('alice')
    const bobId = await userId('bob')
    const res = await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: bobId, message: '   ' })
    expect(res.status).toBe(400)
  })
  it('rejects message over 500 chars', async () => {
    const cookie = await login('alice')
    const bobId = await userId('bob')
    const res = await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: bobId, message: 'x'.repeat(501) })
    expect(res.status).toBe(400)
  })
  it('accepts exactly 500 chars', async () => {
    const cookie = await login('alice')
    const bobId = await userId('bob')
    const res = await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: bobId, message: 'x'.repeat(500) })
    expect(res.status).toBe(201)
  })
  it('rejects non-existent recipient', async () => {
    const cookie = await login('alice')
    const res = await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: 99999, message: 'hi' })
    expect(res.status).toBe(400)
  })
  it('rejects self-kudos', async () => {
    const cookie = await login('alice')
    const aliceId = await userId('alice')
    const res = await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: aliceId, message: 'hi' })
    expect(res.status).toBe(400)
  })
  it('rate limits a second kudos within 10s', async () => {
    const cookie = await login('alice')
    const bobId = await userId('bob')
    await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: bobId, message: 'one' })
    const res = await request(app).post('/api/kudos').set('Cookie', cookie).send({ recipientId: bobId, message: 'two' })
    expect(res.status).toBe(429)
  })
})
