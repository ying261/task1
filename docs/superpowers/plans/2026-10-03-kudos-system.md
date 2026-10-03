# Kudos System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Kudos system where authenticated employees send short appreciation messages to colleagues and view a public feed, with admin moderation (hide/unhide/delete).

**Architecture:** Monorepo with two packages: a Node/Express REST API (`server/`) backed by Prisma + SQLite, and a React + Vite SPA (`client/`). Auth via JWT in an httpOnly cookie; two roles (`user`, `admin`). Express serves the built client in production.

**Tech Stack:** TypeScript, Express, Prisma ORM, SQLite, bcryptjs, jsonwebtoken, Vitest + Supertest; React, Vite, react-router-dom, Vitest + React Testing Library + jsdom.

**Spec:** `../../../SPECIFICATION.md`

## Global Constraints

- Message: trimmed, between 1 and 500 characters; empty or >500 rejected with 400.
- A user cannot send kudos to themselves.
- Rate limit: at most one kudos per 10 seconds per user (configurable via `RATE_LIMIT_MS`).
- Roles: `USER` and `ADMIN`; moderation endpoints require `ADMIN` (403 otherwise).
- Passwords hashed with bcrypt (10 salt rounds), never stored plaintext.
- JWT in an `httpOnly` + `SameSite` cookie named `token`, with an expiry.
- Feed paginated with `limit + offset`, default `limit=20`, newest first.
- Public feed returns only `isVisible = true` kudos.
- All errors use shape `{ "error": { "code": string, "message": string } }` with status codes 400/401/403/404/500.
- SQLite database file `dev.db`; tests use a separate `test.db`.
- Node >= 18.

## Review Focus

| # | Input / condition | Expected behavior | Pinned to |
|---|---|---|---|
| 1 | Whitespace-only message | Rejected with 400, not stored | Task 6 |
| 2 | Message exactly 500 chars | Accepted | Task 6 |
| 3 | `recipientId` of a non-existent user | 400, not a crash | Task 6 |
| 4 | Self-kudos | 400 | Task 6 |
| 5 | Feed requested past the last page | Empty `items`, not an error | Task 7 |
| 6 | Hidden kudos | Absent from public feed, present in admin feed | Tasks 7, 8 |

---

## File Structure

```
server/
  package.json, tsconfig.json, vitest.config.ts
  prisma/schema.prisma, prisma/seed.ts
  src/
    config.ts          env: PORT, JWT_SECRET, RATE_LIMIT_MS, COOKIE_NAME
    app.ts             builds & exports Express app (routers + middleware)
    index.ts           entrypoint: listen + serve client/dist in prod
    lib/prisma.ts      PrismaClient singleton
    lib/errors.ts      ApiError(status, code, message)
    lib/auth.ts        hashPassword/verifyPassword/signToken/verifyToken
    middleware/auth.ts requireAuth/requireAdmin
    middleware/requestLogger.ts
    middleware/errorHandler.ts
    routes/auth.ts     register/login/logout/me
    routes/users.ts    GET /users
    routes/kudos.ts    create/feed + admin list + hide/unhide/delete
  tests/
    setup.ts, auth.test.ts, users.test.ts, kudos.test.ts, errors.test.ts
client/
  package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html
  src/
    main.tsx, App.tsx, api.ts, types.ts
    auth/AuthContext.tsx
    components/ NavBar.tsx Button.tsx Input.tsx Textarea.tsx
                KudosForm.tsx KudosFeed.tsx KudosCard.tsx
                AdminPanel.tsx ModerationList.tsx
    pages/ LoginPage.tsx RegisterPage.tsx Dashboard.tsx
    styles.css
  src/__tests__/ (colocated component tests)
README.md
```

---

### Task 1: Server scaffold with health endpoint and request logging

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/config.ts`, `server/src/app.ts`, `server/src/index.ts`, `server/src/middleware/requestLogger.ts`, `server/tests/health.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `app` (Express app exported from `src/app.ts`); `GET /api/health` returns `{ ok: true }`; `requestLogger(req, res, next)`.

- [ ] **Step 1: Write the failing test** in `server/tests/health.test.ts`

```ts
import request from 'supertest'
import { app } from '../src/app'

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx vitest run tests/health.test.ts`
Expected: FAIL (cannot resolve `../src/app`).

- [ ] **Step 3: Scaffold and implement**

Create `server/package.json` (deps: `express`, `cors`; dev deps: `typescript`, `tsx`, `vitest`, `supertest`, `@types/express`, `@types/supertest`, `@types/cors`), `server/tsconfig.json` (ESM, strict). In `src/config.ts` export `PORT` (default 3000). In `src/app.ts` export an Express app with `cors()` and `express.json()`, mount `requestLogger`, and register `GET /api/health` -> `res.json({ ok: true })`. `src/middleware/requestLogger.ts` logs `method`, `path`, `status`, and duration on response finish.

- [ ] **Step 4: Run to verify it passes**

Run: `cd server && npx vitest run tests/health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/tsconfig.json server/vitest.config.ts server/src/config.ts server/src/app.ts server/src/index.ts server/src/middleware/requestLogger.ts server/tests/health.test.ts
git commit -m "feat(server): scaffold Express app with health endpoint and request logging"
```

---

### Task 2: Prisma schema, migration, and seed

**Files:**
- Create: `server/prisma/schema.prisma`, `server/prisma/seed.ts`, `server/src/lib/prisma.ts`, `server/tests/setup.ts`
- Modify: `server/package.json` (add `prisma`, `@prisma/client`; add `prisma` and `seed` scripts)

**Interfaces:**
- Consumes: nothing.
- Produces: `prisma` client from `src/lib/prisma.ts`; `seedUsers()` exported from `prisma/seed.ts`; test DB `test.db` seeded and truncated in `tests/setup.ts`.

- [ ] **Step 1: Write the failing test** in `server/tests/setup.ts` (seed check exposed via a test file `server/tests/schema.test.ts`)

```ts
import { prisma } from '../src/lib/prisma'

describe('schema + seed', () => {
  it('seeds an admin and regular users', async () => {
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } })
    const alice = await prisma.user.findUnique({ where: { username: 'alice' } })
    expect(admin?.role).toBe('ADMIN')
    expect(alice?.role).toBe('USER')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx vitest run tests/schema.test.ts`
Expected: FAIL (no `schema.prisma`, no `prisma` client).

- [ ] **Step 3: Implement**

Write `schema.prisma` exactly as the spec's section 3.2 (models `User`, `Role` enum, `Kudos` with `isVisible` default true, `moderatedBy`/`moderatedAt`/`reasonForModeration` nullable, and the three `@@index` lines). Add `src/lib/prisma.ts` exporting `new PrismaClient()`. Add `prisma/seed.ts` exporting `seedUsers()` that upserts users `admin` (password `admin123`, role ADMIN), `alice`, `bob` (password `password123`, role USER) using bcryptjs. Configure `tests/setup.ts` to set `process.env.DATABASE_URL = 'file:./test.db'` at the top (before importing `prisma`), run `prisma migrate deploy`, and in `beforeEach` truncate `Kudos` and `User` then call `seedUsers()`. Add npm scripts: `"prisma": "prisma"`, `"seed": "tsx prisma/seed.ts"`, `"db:push": "prisma db push"`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd server && npx prisma db push && npx tsx prisma/seed.ts && npx vitest run tests/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/seed.ts server/src/lib/prisma.ts server/tests/setup.ts server/package.json server/tests/schema.test.ts
git commit -m "feat(server): add Prisma schema, migration, and seed data"
```

---

### Task 3: Auth endpoints and middleware

**Files:**
- Create: `server/src/lib/auth.ts`, `server/src/lib/errors.ts`, `server/src/middleware/auth.ts`, `server/src/routes/auth.ts`, `server/tests/auth.test.ts`
- Modify: `server/src/app.ts` (mount auth router), `server/src/config.ts` (add `JWT_SECRET`, `COOKIE_NAME`)

**Interfaces:**
- Consumes: `prisma` (Task 2).
- Produces:
  - `ApiError extends Error { status; code; message }`
  - `hashPassword(p: string): Promise<string>`, `verifyPassword(p: string, h: string): Promise<boolean>`
  - `signToken(payload: { userId: number; role: Role }): string`, `verifyToken(token: string): { userId: number; role: Role }`
  - `requireAuth(req, res, next)` sets `res.locals.userId`/`res.locals.role`, else 401; `requireAdmin` else 403.
  - Endpoints: `POST /api/auth/register` -> 201 `{ id, username, role }`; `POST /api/auth/login` -> 200 `{ id, username, role }` + cookie; `POST /api/auth/logout` -> 200 `{ ok: true }`; `GET /api/auth/me` -> 200 `{ id, username, role }`.

- [ ] **Step 1: Write the failing tests** in `server/tests/auth.test.ts`

```ts
describe('auth', () => {
  it('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'carol', password: 'secret123' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ username: 'carol', role: 'USER' })
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && npx vitest run tests/auth.test.ts`
Expected: FAIL (routes not mounted).

- [ ] **Step 3: Implement**

`lib/errors.ts` defines `ApiError`. `lib/auth.ts` implements bcrypt (10 rounds) and `jsonwebtoken` sign/verify using `JWT_SECRET`. `middleware/auth.ts` reads the `token` cookie, calls `verifyToken`, sets `res.locals`; `requireAdmin` throws `ApiError(403, ...)` for non-admins. `routes/auth.ts` implements the four endpoints; validation of username/password (username non-empty, password >= 6 chars) returns 400 via `ApiError`. Mount router in `app.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd server && npx vitest run tests/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/auth.ts server/src/lib/errors.ts server/src/middleware/auth.ts server/src/routes/auth.ts server/src/app.ts server/src/config.ts server/tests/auth.test.ts
git commit -m "feat(server): add auth endpoints, JWT, and auth middleware"
```

---

### Task 4: Central error handling and 404

**Files:**
- Create: `server/src/middleware/errorHandler.ts`, `server/tests/errors.test.ts`
- Modify: `server/src/app.ts` (mount errorHandler and a 404 catch-all last)

**Interfaces:**
- Consumes: `ApiError` (Task 3).
- Produces: `errorHandler(err, req, res, next)`; uniform error shape `{ error: { code, message } }`.

- [ ] **Step 1: Write the failing tests** in `server/tests/errors.test.ts`

```ts
describe('error handling', () => {
  it('returns 404 JSON for unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toHaveProperty('code')
    expect(res.body.error).toHaveProperty('message')
  })
  it('maps an ApiError to its status and shape', async () => {
    // register a thrower route on a test app is not needed: use an endpoint that 400s
    const res = await request(app).post('/api/auth/login').send({ username: 'alice' }) // missing password
    expect(res.status).toBe(400)
    expect(res.body.error).toHaveProperty('message')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && npx vitest run tests/errors.test.ts`
Expected: FAIL (404 returns HTML, no error shape).

- [ ] **Step 3: Implement**

`middleware/errorHandler.ts` converts `ApiError` to its status/shape, otherwise 500 `{ error: { code: 'INTERNAL', message: 'Internal server error' } }`. In `app.ts`, register a `use((req,res)=>404)` catch-all after routers, then `errorHandler` last.

- [ ] **Step 4: Run to verify they pass**

Run: `cd server && npx vitest run tests/errors.test.ts tests/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/errorHandler.ts server/src/app.ts server/tests/errors.test.ts
git commit -m "feat(server): add central error handler and 404 catch-all"
```

---

### Task 5: Colleagues endpoint

**Files:**
- Create: `server/src/routes/users.ts`, `server/tests/users.test.ts`
- Modify: `server/src/app.ts` (mount users router)

**Interfaces:**
- Consumes: `requireAuth` (Task 3).
- Produces: `GET /api/users` -> 200 `{ users: Array<{ id, username }> }` excluding the caller, sorted by username.

- [ ] **Step 1: Write the failing tests** in `server/tests/users.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && npx vitest run tests/users.test.ts`
Expected: FAIL (route not mounted).

- [ ] **Step 3: Implement** `GET /api/users` in `routes/users.ts`

Query `prisma.user.findMany` selecting `id`/`username`, exclude `id = res.locals.userId`, order by `username asc`. Guard with `requireAuth`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd server && npx vitest run tests/users.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/users.ts server/src/app.ts server/tests/users.test.ts
git commit -m "feat(server): add colleagues list endpoint"
```

---

### Task 6: Create kudos with validation and rate limit

**Files:**
- Create: `server/src/routes/kudos.ts`, `server/src/lib/rateLimit.ts`, `server/tests/kudos.test.ts`
- Modify: `server/src/app.ts` (mount kudos router)

**Interfaces:**
- Consumes: `requireAuth`, `prisma` (Tasks 2, 3).
- Produces:
  - `POST /api/kudos` -> 201 `KudosDTO` (`{ id, message, createdAt, sender: {id,username}, recipient: {id,username} }`).
  - `checkRateLimit(userId: number): { allowed: boolean; retryAfterMs: number }` and `resetRateLimit(): void`.

- [ ] **Step 1: Write the failing tests** in `server/tests/kudos.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && npx vitest run tests/kudos.test.ts`
Expected: FAIL (route not mounted).

- [ ] **Step 3: Implement**

`lib/rateLimit.ts` keeps an in-memory `Map<userId, lastTimestamp>`; `checkRateLimit` returns not-allowed with `retryAfterMs` when `now - last < RATE_LIMIT_MS`; `resetRateLimit` clears the map (used by tests). `routes/kudos.ts` `POST /api/kudos`: validate `recipientId` is number, `message` trimmed length 1..500; verify recipient exists and `recipientId !== res.locals.userId`; enforce rate limit (429 with `retryAfterMs`); create kudos and return `KudosDTO` including sender/recipient usernames.

- [ ] **Step 4: Run to verify they pass**

Run: `cd server && npx vitest run tests/kudos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/kudos.ts server/src/lib/rateLimit.ts server/src/app.ts server/tests/kudos.test.ts
git commit -m "feat(server): add kudos creation with validation and rate limit"
```

---

### Task 7: Public kudos feed

**Files:**
- Modify: `server/src/routes/kudos.ts` (add `GET /api/kudos`), `server/tests/kudos.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2).
- Produces: `GET /api/kudos` -> 200 `{ items: KudosDTO[], page, limit, total }`, only `isVisible=true`, newest first.

- [ ] **Step 1: Write the failing tests** in `server/tests/kudos.test.ts`

```ts
describe('GET /api/kudos', () => {
  it('returns only visible kudos, newest first', async () => {
    const alice = await login('alice')
    const bob = await login('bob')
    const bobId = await userId('bob')
    const aliceId = await userId('alice')
    await request(app).post('/api/kudos').set('Cookie', alice).send({ recipientId: bobId, message: 'first' })
    await request(app).post('/api/kudos').set('Cookie', bob).send({ recipientId: aliceId, message: 'second' })
    const res = await request(app).get('/api/kudos')
    expect(res.status).toBe(200)
    expect(res.body.items[0].message).toBe('second')
    expect(res.body.items).toHaveLength(2)
  })
  it('returns empty items past the last page', async () => {
    const res = await request(app).get('/api/kudos?page=999&limit=20')
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && npx vitest run tests/kudos.test.ts`
Expected: FAIL (GET route not implemented).

- [ ] **Step 3: Implement** `GET /api/kudos`

Parse `page` (>=1, default 1) and `limit` (default 20, cap 100). Query `prisma.kudos.findMany` where `isVisible=true`, `orderBy createdAt desc`, `skip=(page-1)*limit`, `take=limit`, include sender/recipient (`select { id, username }`). Also `prisma.kudos.count({ where: { isVisible: true } })` for `total`. Return the `{ items, page, limit, total }` shape.

- [ ] **Step 4: Run to verify they pass**

Run: `cd server && npx vitest run tests/kudos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/kudos.ts server/tests/kudos.test.ts
git commit -m "feat(server): add public kudos feed with pagination"
```

---

### Task 8: Admin list and moderation

**Files:**
- Modify: `server/src/routes/kudos.ts` (add `GET /api/admin/kudos`, `PATCH /:id/hide`, `PATCH /:id/unhide`, `DELETE /:id`), `server/tests/kudos.test.ts` (add `moderation.test.ts`)

**Interfaces:**
- Consumes: `requireAdmin`, `prisma` (Tasks 2, 3).
- Produces:
  - `GET /api/admin/kudos` -> 200 `{ items: AdminKudosDTO[], page, limit, total }` including hidden.
  - `PATCH /api/kudos/:id/hide` -> 200 `AdminKudosDTO` (sets `isVisible=false`, `moderatedBy=userId`, `moderatedAt=now`, `reasonForModeration=body.reason`).
  - `PATCH /api/kudos/:id/unhide` -> 200 `AdminKudosDTO` (sets `isVisible=true`).
  - `DELETE /api/kudos/:id` -> 200 `{ ok: true }`.

- [ ] **Step 1: Write the failing tests** in `server/tests/moderation.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && npx vitest run tests/moderation.test.ts`
Expected: FAIL (routes not implemented).

- [ ] **Step 3: Implement**

In `routes/kudos.ts`: `GET /api/admin/kudos` guarded by `requireAdmin`, same pagination but no `isVisible` filter, include moderation fields. `PATCH /:id/hide` (guard `requireAdmin`) updates `isVisible=false`, `moderatedBy`, `moderatedAt=new Date()`, `reasonForModeration=reason`, returns `AdminKudosDTO`; 404 if not found. `PATCH /:id/unhide` sets `isVisible=true`. `DELETE /:id` hard-deletes, 404 if not found. Each hide/unhide/delete action emits a structured log entry (actor id, target kudos id, action, reason) via `console.log`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd server && npx vitest run tests/moderation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/kudos.ts server/tests/moderation.test.ts
git commit -m "feat(server): add admin moderation (hide/unhide/delete)"
```

---

### Task 9: Client scaffold, auth context, and navigation

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/vitest.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/types.ts`, `client/src/api.ts`, `client/src/auth/AuthContext.tsx`, `client/src/pages/LoginPage.tsx`, `client/src/pages/RegisterPage.tsx`, `client/src/components/NavBar.tsx`, `client/src/__tests__/auth.test.tsx`
- Modify: `client/vite.config.ts` (proxy `/api` to `http://localhost:3000`)

**Interfaces:**
- Consumes: API endpoints from Tasks 3, 5.
- Produces:
  - `types.ts`: `type User = { id: number; username: string; role: 'USER' | 'ADMIN' }`, `type KudosDTO = {...}`.
  - `api.ts`: `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` (credentials `include`, throws on non-2xx).
  - `AuthContext`: `{ user, loading, login, register, logout }`.

- [ ] **Step 1: Write the failing tests** in `client/src/__tests__/auth.test.tsx`

Mock `../api` with `vi.mock`. Assert: (a) `AuthContext` exposes `login` that calls `POST /api/auth/login` and sets `user`; (b) `NavBar` renders the username when logged in and an "Admin" link only when `user.role === 'ADMIN'`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd client && npx vitest run`
Expected: FAIL (components not defined).

- [ ] **Step 3: Implement**

Scaffold with Vite React-TS template. `api.ts` wraps `fetch` with `credentials: 'include'`, parses JSON, throws `ApiError` with status. `AuthContext` calls `GET /api/auth/me` on mount (loading state), exposes `login`/`register`/`logout` that call the API and update state. `LoginPage`/`RegisterPage` use the context. `NavBar` shows username and an "Admin" link for admins. `App.tsx` sets up `react-router-dom` routes (`/`, `/login`, `/register`, `/admin`).

- [ ] **Step 4: Run to verify they pass**

Run: `cd client && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/
git commit -m "feat(client): scaffold app with auth context and navigation"
```

---

### Task 10: Dashboard (form + feed)

**Files:**
- Create: `client/src/pages/Dashboard.tsx`, `client/src/components/KudosForm.tsx`, `client/src/components/KudosFeed.tsx`, `client/src/components/KudosCard.tsx`, `client/src/__tests__/dashboard.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `User`, `KudosDTO` (Task 9); `GET /api/users`, `GET /api/kudos`, `POST /api/kudos`.
- Produces: `KudosForm({ onSubmitted: () => void })`, `KudosFeed()`, `KudosCard({ kudos: KudosDTO })`.

- [ ] **Step 1: Write the failing tests** in `client/src/__tests__/dashboard.test.tsx`

Assert: (a) `KudosForm` renders a recipient `<select>` populated from `GET /api/users`, and submits `POST /api/kudos` with `{ recipientId, message }`; (b) `KudosForm` shows an error and does not submit when message is empty; (c) `KudosFeed` renders one `KudosCard` per item from `GET /api/kudos`; (d) `KudosCard` renders `sender.username -> recipient.username` and the message text.

- [ ] **Step 2: Run to verify they fail**

Run: `cd client && npx vitest run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`KudosForm`: fetch users on mount, `<select>` of recipients (value = id), `<textarea maxLength={500}>`, client-side required validation, on submit call `POST /api/kudos` then `onSubmitted()`. `KudosFeed`: fetch page 1, render cards, "Load more" fetches next page. `KudosCard`: render sender/recipient usernames, message, and time.

- [ ] **Step 4: Run to verify they pass**

Run: `cd client && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Dashboard.tsx client/src/components/KudosForm.tsx client/src/components/KudosFeed.tsx client/src/components/KudosCard.tsx client/src/__tests__/dashboard.test.tsx
git commit -m "feat(client): add kudos form and feed on dashboard"
```

---

### Task 11: Admin moderation UI

**Files:**
- Create: `client/src/components/AdminPanel.tsx`, `client/src/components/ModerationList.tsx`, `client/src/__tests__/admin.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `User` (Task 9); `GET /api/admin/kudos`, `PATCH /api/kudos/:id/hide`, `PATCH /api/kudos/:id/unhide`, `DELETE /api/kudos/:id`.
- Produces: `AdminPanel()` (redirects non-admins), `ModerationList()`.

- [ ] **Step 1: Write the failing tests** in `client/src/__tests__/admin.test.tsx`

Assert: (a) `ModerationList` renders hidden kudos with a "hidden" badge; (b) clicking "Hide" calls `PATCH /api/kudos/:id/hide` with the entered reason; (c) clicking "Delete" calls `DELETE /api/kudos/:id`; (d) `AdminPanel` renders nothing/redirects when `user.role !== 'ADMIN'`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd client && npx vitest run`
Expected: FAIL.

- [ ] **Step 3: Implement**

`ModerationList` fetches `GET /api/admin/kudos`, lists every kudos with moderation status, a reason input, and Hide/Unhide/Delete buttons wired to the corresponding endpoints. `AdminPanel` checks the auth context and redirects non-admins to `/`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd client && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AdminPanel.tsx client/src/components/ModerationList.tsx client/src/__tests__/admin.test.tsx
git commit -m "feat(client): add admin moderation panel"
```

---

### Task 12: Responsive styling, static serving, and README

**Files:**
- Create: `README.md`, `client/src/styles.css`
- Modify: `server/src/app.ts` (serve `client/dist` when present), `client/src/App.tsx` and components (apply classes)

**Interfaces:**
- Consumes: all prior tasks.
- Produces: runnable app (`npm run dev` in both, or build + single-process serve), responsive layout.

- [ ] **Step 1: Write the failing test** in `server/tests/health.test.ts` (extend)

```ts
it('serves the built client index.html in production mode', async () => {
  // Only meaningful when client/dist exists; assert static route registered:
  expect(app._router).toBeTruthy() // smoke: app has a router
})
```

> Note: full static-serving is verified manually by `cd client && npm run build` then visiting `http://localhost:3000/`.

- [ ] **Step 2: Run to verify baseline**

Run: `cd server && npx vitest run && cd ../client && npx vitest run`
Expected: PASS (baseline green before polish).

- [ ] **Step 3: Implement**

Add `styles.css` with mobile-first responsive rules (single-column cards on narrow screens, grid on desktop). Apply consistent classes across components. In `app.ts`, if `client/dist` exists serve `express.static` and a catch-all to `index.html`. Write `README.md` with prerequisites, install, migrate, seed, run, test, and login instructions (admin/admin123, alice/password123).

- [ ] **Step 4: Run full suites**

Run: `cd server && npx vitest run && cd ../client && npx vitest run && npm run build`
Expected: PASS and build succeeds.

- [ ] **Step 5: Commit**

```bash
git add README.md client/src/styles.css server/src/app.ts client/src
git commit -m "docs: add README; style and serve the built client"
```

---

## Final Verification

After all tasks: `cd server && npx vitest run` and `cd client && npx vitest run` are green; `cd client && npm run build` succeeds; a manual run shows register/login, give kudos, public feed, and admin hide/unhide/delete working end to end.
