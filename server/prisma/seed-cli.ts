import { seedUsers } from './seed'
import { prisma } from '../src/lib/prisma'

seedUsers()
  .then(() => {
    console.log('Seed complete')
    return prisma.$disconnect()
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
