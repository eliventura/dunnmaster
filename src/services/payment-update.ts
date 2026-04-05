import { SignJWT, jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'secret')
const TOKEN_EXPIRY_HOURS = 48

export const generatePaymentUpdateToken = async (recoveryCaseId: string): Promise<string> => {
  const token = await new SignJWT({ recoveryCaseId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY_HOURS}h`)
    .sign(SECRET)

  await prisma.paymentUpdateSession.create({
    data: {
      recoveryCaseId,
      token,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  })

  return token
}

export const validatePaymentUpdateToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    const session = await prisma.paymentUpdateSession.findUnique({
      where: { token },
      include: {
        recoveryCase: {
          include: {
            business: { include: { brandingSettings: true } },
          },
        },
      },
    })

    if (!session) return null
    if (session.status !== 'ACTIVE') return null
    if (session.expiresAt < new Date()) return null

    return { session, recoveryCaseId: payload.recoveryCaseId as string }
  } catch {
    return null
  }
}

export const markSessionUsed = async (token: string) => {
  await prisma.paymentUpdateSession.update({
    where: { token },
    data: { status: 'USED', usedAt: new Date() },
  })
}
