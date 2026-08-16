import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx,astro}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        colors: {
          cream: {
            50: { value: "#faf7f0" },
            100: { value: "#f3ede0" },
            200: { value: "#e9e0cb" },
            300: { value: "#ddd2b7" },
          },
          ink: {
            700: { value: "#5c5646" },
            800: { value: "#3a3629" },
            900: { value: "#211e17" },
          },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
