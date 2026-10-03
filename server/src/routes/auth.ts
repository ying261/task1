import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { hashPassword, verifyPassword, signToken } from '../lib/auth'
import { requireAuth } from '../middleware/auth'
import { COOKIE_NAME } from '../config'

export const authRouter = Router()

authRouter.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {}
    if (typeof username !== 'string' || !username.trim()) {
      throw new ApiError(400, 'VALIDATION', 'Username is required')
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new ApiError(400, 'VALIDATION', 'Password must be at least 6 characters')
    }
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      throw new ApiError(409, 'CONFLICT', 'Username already taken')
    }
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { username, passwordHash, role: 'USER' } })
    res.status(201).json({ id: user.id, username: user.username, role: user.role })
  } catch (e) {
    next(e)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {}
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new ApiError(400, 'VALIDATION', 'Username and password are required')
    }
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid username or password')
    }
    const token = signToken({ userId: user.id, role: user.role })
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
    res.json({ id: user.id, username: user.username, role: user.role })
  } catch (e) {
    next(e)
  }
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME)
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: res.locals.userId } })
    if (!user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'User not found')
    }
    res.json({ id: user.id, username: user.username, role: user.role })
  } catch (e) {
    next(e)
  }
})
