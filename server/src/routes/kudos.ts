import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { requireAuth } from '../middleware/auth'
import { checkRateLimit } from '../lib/rateLimit'

export const kudosRouter = Router()

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
      include: {
        sender: { select: { id: true, username: true } },
        recipient: { select: { id: true, username: true } },
      },
    })

    res.status(201).json({
      id: kudos.id,
      message: kudos.message,
      createdAt: kudos.createdAt,
      sender: kudos.sender,
      recipient: kudos.recipient,
    })
  } catch (e) {
    next(e)
  }
})
