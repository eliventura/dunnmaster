import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BrandingForm } from './branding-form'

const BrandingSettingsPage = async () => {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    include: { brandingSettings: true },
  })

  if (!business) redirect('/login')

  const branding = business.brandingSettings

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Branding Settings</h1>
        <p className="text-muted-foreground">
          Customize how your dunning emails appear to your customers.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Email Branding</CardTitle>
          <CardDescription>
            These settings control the look and feel of recovery emails sent to your customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingForm
            initialData={{
              companyName: branding?.companyName ?? '',
              logoUrl: branding?.logoUrl ?? '',
              primaryColor: branding?.primaryColor ?? '#6366f1',
              accentColor: branding?.accentColor ?? '#4f46e5',
              supportEmail: branding?.supportEmail ?? '',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default BrandingSettingsPage
