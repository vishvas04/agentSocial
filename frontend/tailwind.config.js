/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base:          'var(--surface-base)',
          raised:        'var(--surface-raised)',
          border:        'var(--surface-border)',
          'border-hover':'var(--surface-border-hover)',
          subtle:        'var(--surface-subtle)',
          muted:         'var(--surface-muted)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          disabled:  'var(--text-disabled)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          muted:   'var(--accent-muted)',
          dim:     'var(--accent-dim)',
          subtle:  'var(--accent-subtle)',
        },
        verdict: {
          approve:        'var(--verdict-approve)',
          'approve-bg':   'var(--verdict-approve-bg)',
          'approve-border':'var(--verdict-approve-border)',
          reject:         'var(--verdict-reject)',
          'reject-bg':    'var(--verdict-reject-bg)',
          'reject-border':'var(--verdict-reject-border)',
          pending:        'var(--verdict-pending)',
          'pending-bg':   'var(--verdict-pending-bg)',
          'pending-border':'var(--verdict-pending-border)',
        },
      },
      maxWidth: {
        '8xl': '88rem', // 1408px — follows Tailwind's +8rem step after 7xl (80rem)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        reviewProgress: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn:         'fadeIn 300ms ease-out',
        reviewProgress: 'reviewProgress 1.6s ease-in-out infinite',
        shimmer:        'shimmer 1.5s ease-in-out infinite',
        slideUp:        'slideUp 400ms ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
