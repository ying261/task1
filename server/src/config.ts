import 'dotenv/config'

export const PORT = Number(process.env.PORT ?? 3000)
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
export const COOKIE_NAME = process.env.COOKIE_NAME ?? 'token'
