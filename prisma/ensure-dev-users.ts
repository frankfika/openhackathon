import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { DEV_USERS, DEV_USER_PASSWORD } from './dev-users'

const prisma = new PrismaClient()

async function main() {
  console.log('Ensuring built-in development users...')

  const hashedPassword = bcrypt.hashSync(DEV_USER_PASSWORD, 10)

  for (const user of DEV_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        password: hashedPassword,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        password: hashedPassword,
      },
    })
  }

  console.log(`Ensured ${DEV_USERS.length} development users`)
  console.log('Login password for built-in dev users: password')
  for (const user of DEV_USERS) {
    console.log(`- [${user.role}] ${user.email}`)
  }
}

main()
  .catch((error) => {
    console.error('Failed to ensure development users:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
