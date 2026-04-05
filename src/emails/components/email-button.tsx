import { Button } from '@react-email/components'

interface EmailButtonProps {
  href: string
  brandColor: string
  children: React.ReactNode
}

export const EmailButton = ({ href, brandColor, children }: EmailButtonProps) => (
  <Button
    href={href}
    style={{
      backgroundColor: brandColor,
      color: '#ffffff',
      padding: '12px 24px',
      borderRadius: '6px',
      textDecoration: 'none',
      fontSize: '16px',
      fontWeight: 'bold',
    }}
  >
    {children}
  </Button>
)
