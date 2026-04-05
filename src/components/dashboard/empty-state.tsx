import { Card, CardContent } from '@/components/ui/card'

export const EmptyState = () => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <div className="text-4xl mb-4">-</div>
      <h3 className="text-lg font-semibold mb-2">No recovery cases yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        When a payment fails on a connected Stripe account, a recovery case will appear here
        with retry attempts and dunning email status.
      </p>
    </CardContent>
  </Card>
)
