module.exports = {
  content: ["./src/**/*.{njk,md,css}", "./src/**/*.svg"],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
