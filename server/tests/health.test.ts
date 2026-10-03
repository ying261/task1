import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { app } from '../src/app'

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('static serving', () => {
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  const indexPath = path.join(clientDist, 'index.html')

  let existed = false
  let original = ''

  beforeAll(() => {
    fs.mkdirSync(clientDist, { recursive: true })
    if (fs.existsSync(indexPath)) {
      existed = true
      original = fs.readFileSync(indexPath, 'utf8')
    }
    fs.writeFileSync(indexPath, '<!doctype html><html><body><!-- KUDOS_TEST --></body></html>')
  })

  afterAll(() => {
    if (existed) {
      fs.writeFileSync(indexPath, original)
    } else {
      fs.rmSync(indexPath, { force: true })
    }
  })

  it('serves the built client index.html at /', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('KUDOS_TEST')
  })

  it('serves index.html for client-side routes', async () => {
    const res = await request(app).get('/login')
    expect(res.status).toBe(200)
    expect(res.text).toContain('KUDOS_TEST')
  })

  it('keeps JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
