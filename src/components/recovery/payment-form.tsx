'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentFormProps {
  clientSecret: string
  businessName: string
  logoUrl?: string
  primaryColor: string
  amountDue: number
  currency: string
  token: string
}

const PaymentFormInner = ({ token, primaryColor }: { token: string; primaryColor: string }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError('')

    const { error: setupError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    })

    if (setupError) {
      setError(setupError.message ?? 'Something went wrong')
      setLoading(false)
      return
    }

    const res = await fetch(`/api/payment-update/${token}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId: setupIntent?.id }),
    })

    if (!res.ok) {
      setError('Failed to update payment method')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <p className="text-lg font-semibold text-green-600">
          Payment method updated successfully!
        </p>
        <p className="text-muted-foreground mt-2">
          Your payment will be retried shortly.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full mt-4"
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? 'Updating...' : 'Update Payment Method'}
      </Button>
    </form>
  )
}

export const PaymentForm = ({
  clientSecret,
  businessName,
  logoUrl,
  primaryColor,
  amountDue,
  currency,
  token,
}: PaymentFormProps) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        {logoUrl && (
          <img src={logoUrl} alt={businessName} className="h-10 mx-auto mb-2" />
        )}
        <CardTitle>{businessName}</CardTitle>
        <p className="text-muted-foreground">Update your payment method</p>
        <p className="text-2xl font-bold mt-2">
          {(amountDue / 100).toLocaleString('en-US', { style: 'currency', currency })}
        </p>
      </CardHeader>
      <CardContent>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentFormInner token={token} primaryColor={primaryColor} />
        </Elements>
      </CardContent>
    </Card>
  </div>
)
