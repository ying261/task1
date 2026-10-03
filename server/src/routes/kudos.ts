import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { checkRateLimit } from '../lib/rateLimit'

interface KudosWithPeople {
  id: number
  message: string
  createdAt: Date
  isVisible: boolean
  moderatedBy: number | null
  moderatedAt: Date | null
  reasonForModeration: string | null
  sender: { id: number; username: string }
  recipient: { id: number; username: string }
}

const kudosInclude = {
  sender: { select: { id: true, username: true } },
  recipient: { select: { id: true, username: true } },
}

function toPublicDto(k: KudosWithPeople) {
  return { id: k.id, message: k.message, createdAt: k.createdAt, sender: k.sender, recipient: k.recipient }
}

function toAdminDto(k: KudosWithPeople) {
  return {
    id: k.id,
    message: k.message,
    createdAt: k.createdAt,
    sender: k.sender,
    recipient: k.recipient,
    isVisible: k.isVisible,
    moderatedBy: k.moderatedBy,
    moderatedAt: k.moderatedAt,
    reasonForModeration: k.reasonForModeration,
  }
}

function parseId(raw: string): number {
  const id = Number.parseInt(raw, 10)
  if (!Number.isInteger(id)) {
    throw new ApiError(400, 'VALIDATION', 'Invalid kudos id')
  }
  return id
}

export const kudosRouter = Router()
export const adminKudosRouter = Router()

kudosRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20))
    const where = { isVisible: true }
    const [rows, total] = await Promise.all([
      prisma.kudos.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: kudosInclude,
      }),
      prisma.kudos.count({ where }),
    ])
    res.json({ items: rows.map(toPublicDto), page, limit, total })
  } catch (e) {
    next(e)
  }
})

kudosRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const senderId = res.locals.userId as number
    const { recipientId, message } = req.body ?? {}

    if (typeof recipientId !== 'number' || !Number.isInteger(recipientId)) {
      throw new ApiError(400, 'VALIDATION', 'recipientId must be a number')
    }
    if (typeof message !== 'string' || message.trim().length < 1 || message.trim().length > 500) {
      throw new ApiError(400, 'VALIDATION', 'Message must be between 1 and 500 characters')
    }
    if (recipientId === senderId) {
      throw new ApiError(400, 'VALIDATION', 'You cannot send kudos to yourself')
    }
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } })
    if (!recipient) {
      throw new ApiError(400, 'VALIDATION', 'Recipient not found')
    }

    const rate = checkRateLimit(senderId)
    if (!rate.allowed) {
      throw new ApiError(429, 'RATE_LIMITED', 'Please wait before sending another kudos')
    }

    const kudos = await prisma.kudos.create({
      data: { senderId, recipientId, message: message.trim() },
      include: kudosInclude,
    })

    res.status(201).json(toPublicDto(kudos))
  } catch (e) {
    next(e)
  }
})

kudosRouter.patch('/:id/hide', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null
    const kudos = await prisma.kudos.update({
      where: { id },
      data: { isVisible: false, moderatedBy: res.locals.userId, moderatedAt: new Date(), reasonForModeration: reason },
      include: kudosInclude,
    })
    console.log(JSON.stringify({ actor: res.locals.userId, target: id, action: 'hide', reason }))
    res.json(toAdminDto(kudos))
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return next(new ApiError(404, 'NOT_FOUND', 'Kudos not found'))
    }
    next(e)
  }
})

kudosRouter.patch('/:id/unhide', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    const kudos = await prisma.kudos.update({
      where: { id },
      data: { isVisible: true },
      include: kudosInclude,
    })
    console.log(JSON.stringify({ actor: res.locals.userId, target: id, action: 'unhide' }))
    res.json(toAdminDto(kudos))
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return next(new ApiError(404, 'NOT_FOUND', 'Kudos not found'))
    }
    next(e)
  }
})

kudosRouter.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    await prisma.kudos.delete({ where: { id } })
    console.log(JSON.stringify({ actor: res.locals.userId, target: id, action: 'delete' }))
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return next(new ApiError(404, 'NOT_FOUND', 'Kudos not found'))
    }
    next(e)
  }
})

adminKudosRouter.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20))
    const [rows, total] = await Promise.all([
      prisma.kudos.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: kudosInclude,
      }),
      prisma.kudos.count(),
    ])
    res.json({ items: rows.map(toAdminDto), page, limit, total })
  } catch (e) {
    next(e)
  }
})
