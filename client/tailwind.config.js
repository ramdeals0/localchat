/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#111827",
          raised: "#1f2937",
          border: "#374151",
        },
        accent: {
          DEFAULT: "#22c55e",
          muted: "#166534",
        },
      },
    },
  },
  plugins: [],
};
