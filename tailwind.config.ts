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
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          // Design Ref: seepn-admin-ui-design-system.spec.md OQ-2 — Figma's "재신청"(reapplied)
          // badge text uses a darker amber than accent-600 for AA contrast on accent-100. No
          // exact Figma variable existed for this step, so it's filled in as the standard
          // amber-700 value (matches accent-600's step spacing on the Tailwind default scale).
          700: '#B45309',
        },
        success: { DEFAULT: '#16A34A', 100: '#DCFCE7' },
        error: { DEFAULT: '#DC2626', 100: '#FEE2E2' },
        // Design Ref: seepn-admin-ui-design-system.spec.md §2 — Emerald scale, used for
        // verification/trust-score signals (ProgressBar "complete" state, partner verified
        // badges), never as a generic success color (that's `success` above).
        secondary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Design Ref: same spec §3 — semantic aliases for the Admin dark sidebar re-skin.
        // Kept as a separate named scale (not reusing `neutral`/`primary` directly) so the
        // sidebar's dark-theme intent stays visible in class names (bg-sidebar, text-sidebar-*).
        sidebar: {
          DEFAULT: '#0F172A',
          footer: '#0A1022',
          active: '#1E3A8A',
          accentBar: '#3B82F6',
          activeIcon: '#93C5FD',
          textInactive: '#94A3B8',
          textSection: '#64748B',
          iconInactive: '#334155',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Design Ref: same spec §2.2 — Admin-only stack. Loads Pretendard when the user's
        // OS/browser has it (self-hosting the variable font file is deferred; see spec OQ-8),
        // otherwise falls through to Noto Sans KR (bundled with macOS/Windows) for Korean text.
        'admin-sans': ['var(--font-inter)', 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', 'sans-serif'],
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
        // Design Ref: same spec §2 — Admin-only type scale (all prefixed `admin-*` so it never
        // collides with the buyer-facing tokens above, which stay untouched).
        'admin-display-1': ['48px', { lineHeight: '56px', fontWeight: '700' }],
        'admin-display-2': ['36px', { lineHeight: '44px', fontWeight: '700' }],
        'admin-display-3': ['30px', { lineHeight: '38px', fontWeight: '700' }],
        'admin-heading-1': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'admin-heading-2': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'admin-heading-3': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'admin-body-lg': ['16px', { lineHeight: '24px' }],
        'admin-body': ['14px', { lineHeight: '22px' }],
        'admin-body-sm': ['12px', { lineHeight: '18px' }],
        'admin-label': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'admin-label-sm': ['12px', { lineHeight: '16px', fontWeight: '600' }],
        'admin-code': ['13px', { lineHeight: '20px' }],
      },
      borderRadius: {
        sm: '4px',
        input: '8px',
        card: '12px',
        xl: '16px',
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
