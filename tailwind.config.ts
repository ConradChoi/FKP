import type { Config } from 'tailwindcss'

// Design Ref: Figma "FKP Colors" variable collection + text styles
// (fileKey 5ZJiik4UX6q8UjDRiIW01c) — values copied 1:1, do not hand-edit hex codes.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        accent: {
          500: '#F59E0B',
          600: '#D97706',
        },
        success: '#16A34A',
        error: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-hero': ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h1: ['36px', { lineHeight: '44px', fontWeight: '700' }],
        h2: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        body: ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'label-button': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'label-caption': ['12px', { lineHeight: '16px' }],
      },
      borderRadius: {
        input: '8px',
        card: '12px',
      },
      spacing: {
        'section-y': '80px',
        'section-x': '120px',
        'section-x-mobile': '20px',
      },
    },
  },
  plugins: [],
}

export default config
