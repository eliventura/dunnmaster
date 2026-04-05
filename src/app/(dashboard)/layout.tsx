import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings/stripe', label: 'Stripe' },
  { href: '/settings/branding', label: 'Branding' },
  { href: '/settings/billing', label: 'Billing' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-muted/40 p-6">
        <Link href="/dashboard" className="text-xl font-bold mb-8 block">
          Dunn Master
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
