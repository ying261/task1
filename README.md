# Kudos

An internal employee-portal Kudos system: colleagues publicly appreciate one
another, and admins moderate inappropriate content.

Built with TypeScript, Express, Prisma (SQLite), React (Vite), and tested with
Vitest + Supertest (server) and Vitest + React Testing Library (client).

See [SPECIFICATION.md](./SPECIFICATION.md) for the full product specification.

## Prerequisites

- Node.js 18+ (built and tested on Node 24)
- npm

## Install

```bash
# server
cd server
npm install

# client
cd ../client
npm install
```

## Configure

```bash
cd server
cp .env.example .env   # set JWT_SECRET to a long random string
```

## Database

```bash
cd server
npm run db:push    # create/apply the Prisma schema (SQLite)
npm run db:seed    # seed users (see below)
```

## Run

Two terminals, from the repo root:

```bash
# terminal 1 — API on http://localhost:3000
cd server && npm run dev

# terminal 2 — Vite dev server on http://localhost:5173 (proxies /api)
cd client && npm run dev
```

Or build and serve the client from the API process directly:

```bash
cd client && npm run build
cd ../server && npm start
# open http://localhost:3000
```

## Test

```bash
cd server && npm test
cd ../client && npm test
```

## Seeded users

| Username | Password    | Role  |
| -------- | ----------- | ----- |
| admin    | admin123    | ADMIN |
| alice    | password123 | USER  |
| bob      | password123 | USER  |

- Users give kudos on the dashboard after logging in.
- Admins moderate (hide / unhide / delete) at `/admin`.
