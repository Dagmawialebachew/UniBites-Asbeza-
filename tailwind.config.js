module.exports = {
  content: ["./*.html", "./*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#FF7A00",
          glow: "rgba(255, 122, 0, 0.35)",
        },
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(255, 122, 0, 0.35)",
      },
    },
  },
  plugins: [],
};
