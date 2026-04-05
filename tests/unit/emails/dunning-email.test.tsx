import { render } from '@testing-library/react'
import { DunningEmail, getSubjectForStep } from '@/emails/dunning-email'

const defaultProps = {
  companyName: 'Acme Corp',
  logoUrl: 'https://acme.com/logo.png',
  brandColor: '#ff6600',
  customerName: 'Jane Doe',
  updatePaymentUrl: 'https://app.dunnmaster.com/update-payment/rc_123',
}

describe('DunningEmail', () => {
  describe('step 1 - friendly notice', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<DunningEmail {...defaultProps} step={1} />)
      ).not.toThrow()
    })

    it('renders friendly notice content', () => {
      const { container } = render(<DunningEmail {...defaultProps} step={1} />)
      const html = container.innerHTML

      expect(html).toContain('Acme Corp')
      expect(html).toContain('Jane Doe')
      expect(html).toContain('trouble processing')
      expect(html).toContain('Update Payment Method')
    })

    it('matches snapshot', () => {
      const { container } = render(<DunningEmail {...defaultProps} step={1} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('step 2 - urgency', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<DunningEmail {...defaultProps} step={2} />)
      ).not.toThrow()
    })

    it('renders urgency content', () => {
      const { container } = render(<DunningEmail {...defaultProps} step={2} />)
      const html = container.innerHTML

      expect(html).toContain('unable to process')
      expect(html).toContain('avoid any interruption')
    })

    it('matches snapshot', () => {
      const { container } = render(<DunningEmail {...defaultProps} step={2} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('step 3 - final warning', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<DunningEmail {...defaultProps} step={3} />)
      ).not.toThrow()
    })

    it('renders final warning content', () => {
      const { container } = render(<DunningEmail {...defaultProps} step={3} />)
      const html = container.innerHTML

      expect(html).toContain('final notice')
      expect(html).toContain('suspended')
      expect(html).toContain('immediately')
    })

    it('matches snapshot', () => {
      const { container } = render(<DunningEmail {...defaultProps} step={3} />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('edge cases', () => {
    it('renders without customerName', () => {
      const { container } = render(
        <DunningEmail {...defaultProps} customerName="" step={1} />
      )
      expect(container.innerHTML).toContain('there')
    })

    it('renders without logoUrl', () => {
      expect(() =>
        render(
          <DunningEmail
            {...defaultProps}
            logoUrl={undefined}
            step={1}
          />
        )
      ).not.toThrow()
    })
  })

  describe('getSubjectForStep', () => {
    it('returns correct subject for step 1', () => {
      expect(getSubjectForStep(1, 'Acme')).toBe(
        'Acme: There was a problem with your payment'
      )
    })

    it('returns correct subject for step 2', () => {
      expect(getSubjectForStep(2, 'Acme')).toBe(
        'Acme: Action needed: update your payment method'
      )
    })

    it('returns correct subject for step 3', () => {
      expect(getSubjectForStep(3, 'Acme')).toBe(
        'Acme: Final notice before account suspension'
      )
    })
  })
})
