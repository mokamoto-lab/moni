import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Prototype dashboard. Uses a relative base so the static build can be served
// from any sub-path (e.g. GitHub Pages or a preview server).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
