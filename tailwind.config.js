/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        midnight: {
          950: '#070A12',
          900: '#0B1120',
          850: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        indigo: {
          950: '#131138',
          900: '#1E1B4B',
          800: '#28236E',
          700: '#3730A3',
          600: '#4338CA',
          500: '#4F46E5',
          400: '#6366F1',
          100: '#E0E7FF',
          50:  '#EEF2FF',
        },
        emerald: {
          900: '#064E3B',
          800: '#065F46',
          700: '#047857',
          600: '#059669',
          500: '#10B981',
          400: '#34D399',
          100: '#D1FAE5',
          50:  '#ECFDF5',
        },
        amber: {
          900: '#78350F',
          800: '#92400E',
          700: '#B45309',
          600: '#D97706',
          500: '#F59E0B',
          100: '#FEF3C7',
          50:  '#FFFBEB',
        },
      },
      boxShadow: {
        'luxury-xs': '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        'luxury-sm': '0 2px 4px -1px rgba(15, 23, 42, 0.04), 0 4px 12px -2px rgba(15, 23, 42, 0.03)',
        'luxury': '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 12px 32px -4px rgba(15, 23, 42, 0.04)',
        'luxury-card': '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 20px 48px -12px rgba(15, 23, 42, 0.04)',
        'luxury-btn': '0 8px 20px -4px rgba(79, 70, 229, 0.38), 0 2px 6px -1px rgba(79, 70, 229, 0.2)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.25)',
      },
      animation: {
        'fade-in':   'fadeIn 0.3s ease-in-out',
        'slide-up':  'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
