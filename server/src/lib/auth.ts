import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { JWT_SECRET } from '../config'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: { userId: number; role: Role }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: number; role: Role } {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
  return { userId: decoded.userId as number, role: decoded.role as Role }
}
