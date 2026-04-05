'use client'

import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { RecoveryCaseWithRelations } from '@/types/recovery'
import type { RecoveryCaseStatus, RecoveryPhase } from '@/generated/prisma/client'

interface RecoveryCaseTableProps {
  cases: RecoveryCaseWithRelations[]
}

const STATUS_VARIANT: Record<RecoveryCaseStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  RETRYING: 'default',
  EMAILING: 'secondary',
  RECOVERED: 'default',
  FAILED: 'destructive',
  CANCELLED: 'outline',
  PAUSED: 'outline',
}

const formatCurrency = (amountCents: number, currency: string) => {
  const amount = amountCents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const getNextAction = (status: RecoveryCaseStatus, phase: RecoveryPhase) => {
  if (status === 'RECOVERED') return 'Completed'
  if (status === 'FAILED') return 'No action'
  if (status === 'CANCELLED') return 'Cancelled'
  if (status === 'PAUSED') return 'Paused'
  if (phase === 'RETRY') return 'Retry payment'
  if (phase === 'EMAIL') return 'Send dunning email'
  return 'N/A'
}

export const RecoveryCaseTable = ({ cases }: RecoveryCaseTableProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Customer Email</TableHead>
        <TableHead>Amount</TableHead>
        <TableHead>Decline Type</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Phase</TableHead>
        <TableHead>Next Action</TableHead>
        <TableHead>Created</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {cases.map((c) => (
        <TableRow key={c.id}>
          <TableCell>
            <Link
              href={`/recovery/${c.id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {c.customerEmail}
            </Link>
          </TableCell>
          <TableCell>{formatCurrency(c.amountDue, c.currency)}</TableCell>
          <TableCell>{c.declineType}</TableCell>
          <TableCell>
            <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
          </TableCell>
          <TableCell>{c.phase}</TableCell>
          <TableCell>{getNextAction(c.status, c.phase)}</TableCell>
          <TableCell>{formatDate(c.createdAt)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)
