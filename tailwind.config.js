module.exports = {
  content: ["./src/**/*.{njk,md,css}", "./src/**/*.svg"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        wenkai: ["LXGW WenKai Screen", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
