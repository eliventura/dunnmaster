import type { NextConfig } from 'next'

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.stripe.com https://o.resend.com;
  font-src 'self' data:;
  frame-src 'self' https://*.stripe.com;
  connect-src 'self' https://api.stripe.com https://*.resend.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\n/g, ' ').trim()

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
