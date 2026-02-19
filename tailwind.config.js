module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './reducers/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        bg2: 'var(--color-bg2)',
        surface: 'var(--color-surface)',
        primary: 'var(--color-primary)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        bouton: 'var(--color-bouton)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'serif'],
        script: ['var(--font-script)', 'cursive'],
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
};
