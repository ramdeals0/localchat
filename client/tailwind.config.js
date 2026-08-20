/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--color-bg-base)",
        elevated: "var(--color-bg-elevated)",
        muted: "var(--color-bg-muted)",
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        accent: {
          DEFAULT: "var(--color-accent)",
          muted: "var(--color-accent-muted)",
          text: "var(--color-accent-text)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        success: "var(--color-success)",
        info: "var(--color-info)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        panel: "var(--shadow-sm)",
        overlay: "var(--shadow-md)",
      },
      transitionDuration: {
        standard: "var(--motion-standard)",
        fast: "var(--motion-fast)",
      },
      width: {
        sidebar: "var(--sidebar-width)",
        context: "var(--context-width)",
      },
    },
  },
  plugins: [],
};
