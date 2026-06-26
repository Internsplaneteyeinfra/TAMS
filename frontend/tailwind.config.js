module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'tams-primary': '#0066cc',
        'tams-secondary': '#00b4d8',
        'tams-danger': '#d62828',
        'tams-success': '#06a77d',
        'tams-warning': '#f77f00',
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
    },
  },
  plugins: [],
}
