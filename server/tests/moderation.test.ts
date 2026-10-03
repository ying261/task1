import request from 'supertest'
import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { resetRateLimit } from '../src/lib/rateLimit'

async function adminCookie() {
  const r = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' })
  return r.headers['set-cookie'][0]
}
async function createKudos() {
  const c = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' })
  const bobId = (await prisma.user.findUnique({ where: { username: 'bob' } }))!.id
  const res = await request(app).post('/api/kudos').set('Cookie', c.headers['set-cookie'][0])
    .send({ recipientId: bobId, message: 'moderate me' })
  return res.body.id
}

beforeEach(resetRateLimit)

describe('moderation', () => {
  it('requires admin (403 for regular user)', async () => {
    const c = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'password123' })
    const id = await createKudos()
    const res = await request(app).patch(`/api/kudos/${id}/hide`).set('Cookie', c.headers['set-cookie'][0]).send({ reason: 'spam' })
    expect(res.status).toBe(403)
  })
  it('admin hides and records moderation fields', async () => {
    const cookie = await adminCookie()
    const id = await createKudos()
    const res = await request(app).patch(`/api/kudos/${id}/hide`).set('Cookie', cookie).send({ reason: 'spam' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ isVisible: false, reasonForModeration: 'spam' })
    expect(res.body.moderatedBy).toBeTruthy()
  })
  it('hidden kudos absent from public feed but present in admin feed', async () => {
    const cookie = await adminCookie()
    const id = await createKudos()
    await request(app).patch(`/api/kudos/${id}/hide`).set('Cookie', cookie).send({ reason: 'spam' })
    const pub = await request(app).get('/api/kudos')
    expect(pub.body.items.some((k: any) => k.id === id)).toBe(false)
    const adm = await request(app).get('/api/admin/kudos').set('Cookie', cookie)
    expect(adm.body.items.some((k: any) => k.id === id)).toBe(true)
  })
  it('admin unhides', async () => {
    const cookie = await adminCookie()
    const id = await createKudos()
    await request(app).patch(`/api/kudos/${id}/hide`).set('Cookie', cookie).send({ reason: 'spam' })
    const res = await request(app).patch(`/api/kudos/${id}/unhide`).set('Cookie', cookie)
    expect(res.body.isVisible).toBe(true)
  })
  it('admin deletes', async () => {
    const cookie = await adminCookie()
    const id = await createKudos()
    const res = await request(app).delete(`/api/kudos/${id}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    const adm = await request(app).get('/api/admin/kudos').set('Cookie', cookie)
    expect(adm.body.items.some((k: any) => k.id === id)).toBe(false)
  })
})
