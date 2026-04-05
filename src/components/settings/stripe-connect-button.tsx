'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export const StripeConnectButton = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error?.message ?? 'Failed to initiate Stripe Connect')
      }

      const { data } = await response.json()
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleConnect}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Connecting...' : 'Connect Stripe Account'}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
