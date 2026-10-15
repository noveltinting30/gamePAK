/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#172139',
        muted: '#7b8498',
        brand: '#6759dc',
        lilac: '#f0edff',
      },
      boxShadow: {
        card: '0 12px 34px rgba(31, 42, 74, .055)',
      },
    },
  },
  plugins: [],
}
