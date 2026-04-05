import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const POST = async (req: NextRequest) => {
  const body = await req.json()
  const { name, email, password } = body

  if (!name || !email || !password) {
    return errorResponse('MISSING_FIELDS', 'Name, email, and password are required')
  }

  if (!EMAIL_REGEX.test(email)) {
    return errorResponse('INVALID_EMAIL', 'Please provide a valid email address')
  }

  if (password.length < 8) {
    return errorResponse('WEAK_PASSWORD', 'Password must be at least 8 characters')
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return errorResponse('USER_EXISTS', 'An account with this email already exists', 409)
  }

  // TODO: Hash password with bcrypt before storing
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password,
    },
  })

  return successResponse({ id: user.id, email: user.email }, 201)
}
