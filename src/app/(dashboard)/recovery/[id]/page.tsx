import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RetryStatus, EmailStatus, RecoveryCaseStatus } from '@/generated/prisma/client'

const STATUS_VARIANT: Record<RecoveryCaseStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  RETRYING: 'default',
  EMAILING: 'secondary',
  RECOVERED: 'default',
  FAILED: 'destructive',
  CANCELLED: 'outline',
  PAUSED: 'outline',
}

const RETRY_STATUS_VARIANT: Record<RetryStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SCHEDULED: 'outline',
  EXECUTING: 'secondary',
  SUCCEEDED: 'default',
  FAILED: 'destructive',
  CANCELLED: 'outline',
}

const EMAIL_STATUS_VARIANT: Record<EmailStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SCHEDULED: 'outline',
  SENT: 'default',
  CANCELLED: 'outline',
  FAILED: 'destructive',
}

const formatCurrency = (amountCents: number, currency: string) => {
  const amount = amountCents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

const formatDateTime = (date: Date | string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const RecoveryCaseDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>
}) => {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
  })

  if (!business) redirect('/settings/stripe')

  const { id } = await params

  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: {
      id,
      businessId: business.id,
    },
    include: {
      retryAttempts: { orderBy: { attemptNumber: 'asc' } },
      dunningEmails: { orderBy: { sequenceNumber: 'asc' } },
      paymentUpdateSessions: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!recoveryCase) notFound()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recovery Case</h1>
        <p className="text-muted-foreground mt-1">{recoveryCase.customerEmail}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={STATUS_VARIANT[recoveryCase.status]}>
              {recoveryCase.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Amount Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(recoveryCase.amountDue, recoveryCase.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Decline Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{recoveryCase.declineCode}</div>
            <p className="text-xs text-muted-foreground mt-1">{recoveryCase.declineType}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{recoveryCase.phase}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Created {formatDateTime(recoveryCase.createdAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retry Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {recoveryCase.retryAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No retry attempts yet</p>
          ) : (
            <div className="space-y-4">
              {recoveryCase.retryAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Attempt #{attempt.attemptNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled: {formatDateTime(attempt.scheduledAt)}
                    </p>
                    {attempt.executedAt && (
                      <p className="text-xs text-muted-foreground">
                        Executed: {formatDateTime(attempt.executedAt)}
                      </p>
                    )}
                    {attempt.failureMessage && (
                      <p className="text-xs text-destructive mt-1">
                        {attempt.failureCode}: {attempt.failureMessage}
                      </p>
                    )}
                  </div>
                  <Badge variant={RETRY_STATUS_VARIANT[attempt.status]}>
                    {attempt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dunning Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {recoveryCase.dunningEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dunning emails yet</p>
          ) : (
            <div className="space-y-4">
              {recoveryCase.dunningEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      #{email.sequenceNumber} - {email.templateType}
                    </p>
                    <p className="text-xs text-muted-foreground">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      To: {email.toEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled: {formatDateTime(email.scheduledAt)}
                    </p>
                    {email.sentAt && (
                      <p className="text-xs text-muted-foreground">
                        Sent: {formatDateTime(email.sentAt)}
                      </p>
                    )}
                  </div>
                  <Badge variant={EMAIL_STATUS_VARIANT[email.status]}>
                    {email.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default RecoveryCaseDetailPage
