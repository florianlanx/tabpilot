/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{vue,ts,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        elevated: 'var(--bg-elevated)',
        't-primary': 'var(--text-primary)',
        't-secondary': 'var(--text-secondary)',
        't-tertiary': 'var(--text-tertiary)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        hover: 'var(--hover)',
        'g-blue': 'var(--group-blue)',
        'g-green': 'var(--group-green)',
        'g-purple': 'var(--group-purple)',
        'g-cyan': 'var(--group-cyan)',
        'g-red': 'var(--group-red)',
        'g-yellow': 'var(--group-yellow)',
        'g-pink': 'var(--group-pink)',
        'g-grey': 'var(--group-grey)',
      },
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'card': 'var(--shadow-card)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '8px',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
