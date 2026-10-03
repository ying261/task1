import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../lib/errors'
import { verifyToken } from '../lib/auth'
import { COOKIE_NAME } from '../config'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'))
  }
  try {
    const payload = verifyToken(token)
    res.locals.userId = payload.userId
    res.locals.role = payload.role
    next()
  } catch {
    next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'))
  }
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.role !== 'ADMIN') {
    return next(new ApiError(403, 'FORBIDDEN', 'Admin access required'))
  }
  next()
}
