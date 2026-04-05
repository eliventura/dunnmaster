'use client'

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100)

const getBarColor = (percent: number) => {
  if (percent >= 0.8) return 'bg-red-500'
  if (percent >= 0.6) return 'bg-yellow-500'
  return 'bg-green-500'
}

interface UsageBarProps {
  currentMrr: number
  limit: number
}

const UsageBar = ({ currentMrr, limit }: UsageBarProps) => {
  if (limit === -1) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">MRR Monitored</span>
          <span className="font-medium">{formatCurrency(currentMrr)} / Unlimited</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div className="h-full rounded-full bg-green-500" style={{ width: '5%' }} />
        </div>
      </div>
    )
  }

  const percent = limit > 0 ? currentMrr / limit : 0
  const displayPercent = Math.min(percent, 1)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">MRR Monitored</span>
        <span className="font-medium">
          {formatCurrency(currentMrr)} / {formatCurrency(limit)}{' '}
          ({Math.round(percent * 100)}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(percent)}`}
          style={{ width: `${displayPercent * 100}%` }}
        />
      </div>
    </div>
  )
}

export { UsageBar }
