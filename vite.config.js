import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The punch-list app is served under this subpath of the listing site (cedarview.house).
// Deliberately not a guessable word: the page holds private notes.
export default defineConfig({
  plugins: [react()],
  base: "/prep-7c3/",
});
