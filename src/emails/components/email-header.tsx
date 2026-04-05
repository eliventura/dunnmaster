import { Img, Text } from '@react-email/components'

interface EmailHeaderProps {
  logoUrl?: string
  companyName: string
}

export const EmailHeader = ({ logoUrl, companyName }: EmailHeaderProps) => (
  <>
    {logoUrl && <Img src={logoUrl} alt={companyName} width="120" height="40" />}
    <Text style={{ fontSize: '20px', fontWeight: 'bold' }}>{companyName}</Text>
  </>
)
