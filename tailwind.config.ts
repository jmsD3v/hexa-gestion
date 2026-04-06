import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        brand: {
          primary:       '#6366f1', // indigo-500 — acción principal
          'primary-dim': 'rgba(99,102,241,0.15)',
          hover:         '#4f46e5', // indigo-600
          active:        '#4338ca', // indigo-700
        },
        status: {
          success:     '#22c55e',
          'success-dim': 'rgba(34,197,94,0.12)',
          warning:     '#f59e0b',
          'warning-dim': 'rgba(245,158,11,0.12)',
          danger:      '#ef4444',
          'danger-dim':  'rgba(239,68,68,0.12)',
          info:        '#60a5fa',
          'info-dim':    'rgba(96,165,250,0.12)',
          purple:      '#a78bfa',
          'purple-dim':  'rgba(167,139,250,0.12)',
        },
      },
      keyframes: {
        'modal-in': {
          from: { opacity: '0', transform: 'scale(0.95) translateY(4px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'modal-out': {
          from: { opacity: '1', transform: 'scale(1) translateY(0)' },
          to:   { opacity: '0', transform: 'scale(0.95) translateY(4px)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'fade-slide-fwd': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-slide-back': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'modal-in':        'modal-in 200ms ease-out',
        'modal-out':       'modal-out 150ms ease-in',
        'fade-in':         'fade-in 150ms ease-out',
        'fade-slide-fwd':  'fade-slide-fwd 250ms cubic-bezier(0.4,0,0.2,1)',
        'fade-slide-back': 'fade-slide-back 250ms cubic-bezier(0.4,0,0.2,1)',
      },
    },
  },
  plugins: [],
}
export default config
