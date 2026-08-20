import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base MUST match the repo name for a GitHub Pages project site,
// or every asset 404s. Change this if you rename the repo.
export default defineConfig({
  plugins: [react()],
  base: "/cedarview/",
});
