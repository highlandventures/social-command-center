/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          page: 'rgb(var(--color-bg-page) / <alpha-value>)',
          card: 'rgb(var(--color-bg-card) / <alpha-value>)',
          secondary: 'rgb(var(--color-bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
          hover: 'rgb(var(--color-bg-hover) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          faint: 'rgb(var(--color-text-faint) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-border-secondary) / <alpha-value>)',
        },
        skeleton: 'rgb(var(--color-skeleton) / <alpha-value>)',
        composer: {
          canvas: 'rgb(var(--color-composer-canvas) / <alpha-value>)',
          s0: 'rgb(var(--color-composer-s0) / <alpha-value>)',
          s1: 'rgb(var(--color-composer-s1) / <alpha-value>)',
          s2: 'rgb(var(--color-composer-s2) / <alpha-value>)',
          s3: 'rgb(var(--color-composer-s3) / <alpha-value>)',
          inset: 'rgb(var(--color-composer-inset) / <alpha-value>)',
          ink: 'rgb(var(--color-composer-ink) / <alpha-value>)',
          ink2: 'rgb(var(--color-composer-ink2) / <alpha-value>)',
          ink3: 'rgb(var(--color-composer-ink3) / <alpha-value>)',
          'ink-muted': 'rgb(var(--color-composer-ink-muted) / <alpha-value>)',
        },
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        copilot: 'rgb(var(--color-copilot) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
