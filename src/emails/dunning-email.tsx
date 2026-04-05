import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Hr,
  Preview,
} from '@react-email/components'
import { EmailHeader } from './components/email-header'
import { EmailButton } from './components/email-button'

interface DunningEmailProps {
  companyName: string
  logoUrl?: string
  brandColor: string
  customerName: string
  updatePaymentUrl: string
  step: 1 | 2 | 3
}

const SUBJECTS: Record<1 | 2 | 3, string> = {
  1: 'There was a problem with your payment',
  2: 'Action needed: update your payment method',
  3: 'Final notice before account suspension',
}

const MESSAGES: Record<1 | 2 | 3, string> = {
  1: 'We had trouble processing your recent payment. This can happen for a number of reasons and is usually easy to fix.',
  2: 'We\'ve been unable to process your payment. To avoid any interruption to your service, please update your payment method.',
  3: 'This is your final notice. Your account will be suspended if we cannot process your payment. Please update your payment method immediately.',
}

export const getSubjectForStep = (step: 1 | 2 | 3, companyName: string) =>
  `${companyName}: ${SUBJECTS[step]}`

export const DunningEmail = ({
  companyName,
  logoUrl,
  brandColor = '#6366f1',
  customerName,
  updatePaymentUrl,
  step,
}: DunningEmailProps) => (
  <Html>
    <Head />
    <Preview>{SUBJECTS[step]}</Preview>
    <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'sans-serif', padding: '40px 0' }}>
      <Container style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '8px', maxWidth: '560px' }}>
        <EmailHeader logoUrl={logoUrl} companyName={companyName} />
        <Hr />
        <Text>Hi {customerName || 'there'},</Text>
        <Text>{MESSAGES[step]}</Text>
        <EmailButton href={updatePaymentUrl} brandColor={brandColor}>
          Update Payment Method
        </EmailButton>
        <Hr />
        <Text style={{ fontSize: '12px', color: '#6b7280' }}>
          If you have any questions, please contact {companyName} support.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default DunningEmail
