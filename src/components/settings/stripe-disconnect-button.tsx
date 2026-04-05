'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export const StripeDisconnectButton = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to disconnect your Stripe account? All active recovery cases will be paused.'
    )
    if (!confirmed) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/connect', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error?.message ?? 'Failed to disconnect')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleDisconnect}
        disabled={isLoading}
        variant="destructive"
        size="sm"
      >
        {isLoading ? 'Disconnecting...' : 'Disconnect Stripe'}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
