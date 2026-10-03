import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

export const usersRouter = Router()

usersRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: res.locals.userId } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    })
    res.json({ users })
  } catch (e) {
    next(e)
  }
})
