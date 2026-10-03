import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'

export async function seedUsers() {
  const userHash = await bcrypt.hash('password123', 10)
  const adminHash = await bcrypt.hash('admin123', 10)

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminHash, role: 'ADMIN' },
  })
  await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: { username: 'alice', passwordHash: userHash, role: 'USER' },
  })
  await prisma.user.upsert({
    where: { username: 'bob' },
    update: {},
    create: { username: 'bob', passwordHash: userHash, role: 'USER' },
  })
}
