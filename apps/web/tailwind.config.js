/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        ink: "#1d1f20",
        "ink-soft": "#2a2c2d",
        "ink-muted": "#595e5e",
        "ink-subtle": "#7e8486",
        "line-soft": "#dfe5e7",
        bone: "#f5f9fa",
        air: "#effbff",
        porcelain: "#eef4f6",
      },
    },
  },
  plugins: [],
}
