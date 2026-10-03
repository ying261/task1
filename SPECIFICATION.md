# Kudos System Specification

> Internal employee portal feature for giving and viewing "kudos" (short messages of appreciation between colleagues).

## 1. Overview

The Kudos system lets authenticated employees send a short appreciation message to a colleague and view a public feed of recent kudos on the main dashboard. Administrators can moderate the feed by hiding or deleting inappropriate messages.

The system is built spec-first: this document is the single source of truth for what gets implemented, reviewed, and approved before any code is written.

---

## 2. Functional Requirements

### 2.1 User Stories

1. As a user, I can register an account and log in so that my identity is known.
2. As a user, I can select another user from a list of colleagues.
3. As a user, I can write a short message of appreciation (max 500 characters) and submit it.
4. As a user, I can view a public feed of recently submitted kudos on the dashboard.
5. As an administrator, I can hide an inappropriate kudos message so it no longer appears in the public feed.
6. As an administrator, I can delete an inappropriate kudos message permanently.
7. As an administrator, I can restore a previously hidden kudos message (unhide).

### 2.2 Acceptance Criteria

- **Registration / Login**
  - A user can register with a unique username and a password.
  - A registered user can log in and receive an authenticated session.
  - Passwords are never stored in plaintext.
- **User selection**
  - The kudos form presents a list of all users other than the current user.
- **Kudos creation**
  - Message is required, trimmed, and between 1 and 500 characters; longer input is rejected with a 400.
  - The recipient must be an existing user.
  - A user cannot send kudos to themselves.
  - A user can submit at most one kudos per 10 seconds (rate limit, configurable); an identical submission (same sender, recipient, and message within the rate-limit window) is rejected.
  - A submitted kudos is stored and appears in the public feed.
- **Public feed**
  - The dashboard shows kudos newest-first, paginated (default 20 per page).
  - Only kudos with `is_visible = true` appear in the feed.
- **Moderation (admin only)**
  - An admin can hide a kudos: it is removed from the public feed and the moderation metadata (`moderated_by`, `moderated_at`, `reason_for_moderation`) is recorded.
  - An admin can delete a kudos: it is permanently removed.
  - An admin can unhide a kudos: it reappears in the public feed.
  - Non-admin users receive 403 when calling any moderation endpoint.
- **Validation & error handling**
  - All endpoints return consistent JSON responses with appropriate HTTP status codes.
- **Responsive design**
  - The interface is usable on mobile and desktop screen sizes.

---

## 3. Technical Design

### 3.1 Architecture

Single repository (monorepo) with three units:

- **Backend** - Node.js + Express, REST API under `/api`, Prisma ORM over SQLite.
- **Frontend** - React + Vite single-page application (SPA).
- **Database** - SQLite file (`dev.db`), schema defined and migrated via Prisma.

**Runtime:** in development, the Vite dev server (port 5173) proxies `/api` to Express (port 3000). In production/demo, Express serves the built React static files so the whole app runs in a single process.

**Authentication:** JWT stored in an `httpOnly` + `SameSite` cookie. Passwords are hashed with bcrypt (10 salt rounds). Two roles: `user` and `admin`.

### 3.2 Database Schema

```prisma
enum Role {
  USER
  ADMIN
}

model User {
  id            Int      @id @default(autoincrement())
  username      String   @unique
  passwordHash  String
  role          Role     @default(USER)
  createdAt     DateTime @default(now())
  sentKudos     Kudos[]  @relation("Sent")
  receivedKudos Kudos[]  @relation("Received")
}

model Kudos {
  id                  Int       @id @default(autoincrement())
  senderId            Int
  recipientId         Int
  message             String    // max 500 chars, validated server-side
  createdAt           DateTime  @default(now())
  isVisible           Boolean   @default(true)
  moderatedBy         Int?      // admin user id, nullable
  moderatedAt         DateTime? // moderation timestamp, nullable
  reasonForModeration String?   // moderation reason, nullable
  sender              User      @relation("Sent", fields: [senderId], references: [id])
  recipient           User      @relation("Received", fields: [recipientId], references: [id])

  @@index([isVisible, createdAt])
  @@index([senderId])
  @@index([recipientId])
}
```

**Moderation semantics**
- **Hide** sets `isVisible = false` and records `moderatedBy`, `moderatedAt`, and `reasonForModeration`. Reversible via unhide.
- **Delete** hard-deletes the row. Non-reversible, reserved for severe violations.

### 3.3 API Endpoints

All responses are JSON. Errors use a consistent shape: `{ "error": { "code": string, "message": string } }`.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create account (username, password); password is bcrypt-hashed. |
| POST | `/api/auth/login` | Public | Authenticate; sets JWT in an httpOnly cookie. |
| POST | `/api/auth/logout` | Authenticated | Clears the auth cookie. |
| GET | `/api/auth/me` | Authenticated | Return the current user (`id`, `username`, `role`) to restore session on refresh. |
| GET | `/api/users` | Authenticated | List colleagues (`id`, `username`) for the recipient dropdown. |
| POST | `/api/kudos` | Authenticated | Create a kudos (`recipientId`, `message`). |
| GET | `/api/kudos` | Public | Public feed; `?page=1&limit=20`; returns only `isVisible = true`, newest first. |
| GET | `/api/admin/kudos` | Admin | Moderation feed: all kudos including hidden, paginated, with moderation fields. |
| PATCH | `/api/kudos/:id/hide` | Admin | Set `isVisible = false`; record moderation fields (body: `reason`). |
| PATCH | `/api/kudos/:id/unhide` | Admin | Restore `isVisible = true`. |
| DELETE | `/api/kudos/:id` | Admin | Hard-delete the kudos. |

### 3.4 Frontend Components

```
App (router + auth context)
|-- NavBar            - login/logout, current username, "Admin" link when admin
|-- LoginPage / RegisterPage
|-- Dashboard         - KudosForm + KudosFeed
|   |-- KudosForm     - recipient dropdown + message textarea (500 char) + submit; client-side validation
|   `-- KudosFeed     - paginated list of cards, "Load more" button
|       `-- KudosCard - sender -> recipient + message + timestamp
`-- AdminPanel        - admin only
    `-- ModerationList - all kudos (including hidden), each with hide/unhide/delete + reason input
```

Shared components: `Button`, `Input`, `Textarea`. Responsive layout via CSS (single-column stack on mobile, grid on desktop).

### 3.5 Security

- Passwords stored as bcrypt hashes (10 rounds), never plaintext.
- JWT in an `httpOnly` + `SameSite` cookie with an expiry; not readable from JavaScript.
- Role middleware enforces admin-only access on moderation endpoints.
- SQL injection prevented via Prisma's parameterized queries.
- XSS mitigated by React's default text escaping; `dangerouslySetInnerHTML` is never used.

### 3.6 Performance

- Feed paginated with `limit + offset` (default 20/page), ordered by `createdAt` descending.
- Composite index `(isVisible, createdAt)` supports the feed query.
- Caching is intentionally omitted at training scale (YAGNI); noted as a future enhancement.

### 3.7 Error Handling & Logging

- Central error-handling middleware maps failures to JSON with correct status codes: 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 500 (server error).
- Request logging middleware records method, path, status, and duration.
- Moderation actions (hide/delete/unhide) emit a structured log entry (who, target, reason).

---

## 4. Implementation Plan

### 4.1 Task Breakdown

| # | Task | Depends on |
|---|---|---|
| 1 | Scaffold monorepo: Express backend, Vite React frontend, Prisma + SQLite setup | - |
| 2 | Define Prisma schema (User, Kudos), run migration, seed users (incl. an admin) | 1 |
| 3 | Auth: register/login/logout, bcrypt, JWT, auth + role middleware | 2 |
| 4 | `GET /api/users` colleagues endpoint | 3 |
| 5 | Kudos: `POST /api/kudos` (validation, rate limit, no self-kudos) and `GET /api/kudos` (paginated visible feed) | 3 |
| 6 | Moderation: hide / unhide / delete endpoints (admin-only, record moderation fields) | 5 |
| 7 | Error-handling and request-logging middleware | 3 |
| 8 | Frontend auth: login/register pages, auth context, NavBar | 4 (API contract) |
| 9 | Frontend dashboard: KudosForm, KudosFeed, KudosCard | 5 |
| 10 | Frontend AdminPanel moderation UI | 6 |
| 11 | Responsive styling | 8, 9, 10 |
| 12 | Tests: backend unit + integration, frontend component tests | 5, 6, 9, 10 |
| 13 | Finalize `SPECIFICATION.md` and README (run instructions) | 1-12 |

### 4.2 Testing Strategy

- **Backend** - Vitest + Supertest:
  - Unit tests: message validation, self-kudos rejection, rate limiting, moderation visibility logic.
  - Integration tests: each endpoint's success and failure paths, and authorization (401/403).
- **Frontend** - Vitest + React Testing Library:
  - KudosForm validation, KudosFeed rendering, AdminPanel hide/unhide/delete behavior.

### 4.3 Deployment Considerations

- **Local run:** `npm install` -> migrate + seed -> start backend and frontend dev servers (or build frontend and serve statically from Express).
- **Hosting:** SQLite keeps deployment self-contained; any Node-capable host (e.g., Railway, Render, Fly.io) can run the single Express process serving the built frontend.
- **Secrets:** JWT secret and any configurable values come from environment variables.

---

## 5. Out of Scope (YAGNI)

The following were considered and deliberately excluded: notifications, reactions, comments, editing/deleting one's own kudos, leaderboards, caching/CDN, real SSO integration, and soft-delete audit history. Each can be added later if a requirement emerges.
