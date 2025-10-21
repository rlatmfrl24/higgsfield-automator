import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "src/extension/background.ts"),
        "content-feed-monitor": resolve(
          __dirname,
          "src/extension/content-feed-monitor.ts"
        ),
      },
      output: {
        entryFileNames: (chunk) => {
          if (
            chunk.name === "background" ||
            chunk.name === "content-feed-monitor"
          ) {
            return "[name].js";
          }

          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
