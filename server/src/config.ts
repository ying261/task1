import 'dotenv/config'

const rawSecret = process.env.JWT_SECRET
if (!rawSecret || rawSecret === 'change-me' || rawSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a non-default secret')
}

export const PORT = Number(process.env.PORT ?? 3000)
export const JWT_SECRET = rawSecret
export const COOKIE_NAME = process.env.COOKIE_NAME ?? 'token'
export const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS ?? 10000)
