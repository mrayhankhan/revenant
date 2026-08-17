/**
 * Without this file Next never runs Tailwind, the `@tailwind` directives in
 * globals.css emit nothing, and every utility class in the app silently does
 * nothing — the page still renders, just with no layout at all.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
