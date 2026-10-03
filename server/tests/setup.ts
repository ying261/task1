import { execSync } from 'node:child_process'
import { beforeAll, beforeEach } from 'vitest'
import { prisma } from '../src/lib/prisma'
import { seedUsers } from '../prisma/seed'

beforeAll(() => {
  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  })
})

beforeEach(async () => {
  await prisma.kudos.deleteMany()
  await prisma.user.deleteMany()
  await seedUsers()
})
