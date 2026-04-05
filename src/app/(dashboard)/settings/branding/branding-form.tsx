'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BrandingFormData {
  companyName: string
  logoUrl: string
  primaryColor: string
  accentColor: string
  supportEmail: string
}

interface BrandingFormProps {
  initialData: BrandingFormData
}

export const BrandingForm = ({ initialData }: BrandingFormProps) => {
  const [formData, setFormData] = useState<BrandingFormData>(initialData)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChange = (field: keyof BrandingFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    setMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message ?? 'Failed to save')
      }

      setMessage({ type: 'success', text: 'Branding settings saved successfully.' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="companyName" className="text-sm font-medium">
          Company Name
        </label>
        <Input
          id="companyName"
          value={formData.companyName}
          onChange={handleChange('companyName')}
          placeholder="Your Company"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="logoUrl" className="text-sm font-medium">
          Logo URL
        </label>
        <Input
          id="logoUrl"
          value={formData.logoUrl}
          onChange={handleChange('logoUrl')}
          placeholder="https://example.com/logo.png"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="primaryColor" className="text-sm font-medium">
            Primary Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.primaryColor}
              onChange={handleChange('primaryColor')}
              className="h-8 w-8 cursor-pointer rounded border-0"
            />
            <Input
              id="primaryColor"
              value={formData.primaryColor}
              onChange={handleChange('primaryColor')}
              placeholder="#6366f1"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="accentColor" className="text-sm font-medium">
            Accent Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formData.accentColor}
              onChange={handleChange('accentColor')}
              className="h-8 w-8 cursor-pointer rounded border-0"
            />
            <Input
              id="accentColor"
              value={formData.accentColor}
              onChange={handleChange('accentColor')}
              placeholder="#4f46e5"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="supportEmail" className="text-sm font-medium">
          Support Email
        </label>
        <Input
          id="supportEmail"
          type="email"
          value={formData.supportEmail}
          onChange={handleChange('supportEmail')}
          placeholder="support@yourcompany.com"
        />
      </div>

      {message && (
        <p
          className={
            message.type === 'success'
              ? 'text-sm text-green-600'
              : 'text-sm text-destructive'
          }
        >
          {message.text}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}
