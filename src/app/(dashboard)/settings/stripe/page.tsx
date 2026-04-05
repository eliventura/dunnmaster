import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StripeConnectButton } from '@/components/settings/stripe-connect-button'
import { StripeDisconnectButton } from '@/components/settings/stripe-disconnect-button'

const StripeSettingsPage = async () => {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
  })

  const isConnected = !!business?.stripeAccountId

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stripe Settings</h1>
        <p className="text-muted-foreground">
          Manage your Stripe Connect integration
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stripe Connect</CardTitle>
              <CardDescription>
                Connect your Stripe account to enable payment recovery
              </CardDescription>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Account ID</span>
                  <span className="font-mono">{business.stripeAccountId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Connected</span>
                  <span>
                    {business.stripeConnectedAt
                      ? new Date(business.stripeConnectedAt).toLocaleDateString()
                      : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monitoring</span>
                  <Badge variant={business.monitoringActive ? 'default' : 'outline'}>
                    {business.monitoringActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </div>
              <StripeDisconnectButton />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Stripe account to start monitoring failed payments
                and automatically recover lost revenue.
              </p>
              <StripeConnectButton />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default StripeSettingsPage
