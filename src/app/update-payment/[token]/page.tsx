import { PaymentForm } from '@/components/recovery/payment-form'

interface PageProps {
  params: Promise<{ token: string }>
}

const UpdatePaymentPage = async ({ params }: PageProps) => {
  const { token } = await params

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/payment-update/${token}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Link Expired
          </h1>
          <p className="text-muted-foreground">
            This payment update link is no longer valid. Please contact the
            business for a new link.
          </p>
        </div>
      </div>
    )
  }

  const { data } = await res.json()

  return (
    <PaymentForm
      clientSecret={data.clientSecret}
      businessName={data.businessName}
      logoUrl={data.logoUrl}
      primaryColor={data.primaryColor}
      amountDue={data.amountDue}
      currency={data.currency}
      token={token}
    />
  )
}

export default UpdatePaymentPage
