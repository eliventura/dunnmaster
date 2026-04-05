import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) return null

        // TODO: replace with bcrypt.compare(credentials.password, user.password)
        const isValid = credentials.password === user.password

        if (!isValid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    session: ({ session, token }) => {
      if (token?.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})
