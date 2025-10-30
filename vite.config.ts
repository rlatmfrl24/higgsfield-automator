import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@presentation": resolve(__dirname, "src/presentation"),
      "@application": resolve(__dirname, "src/application"),
      "@domain": resolve(__dirname, "src/domain"),
      "@infrastructure": resolve(__dirname, "src/infrastructure"),
      "@extension": resolve(__dirname, "src/extension"),
    },
  },
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
        manualChunks(id) {
          if (id.includes("src/extension/")) {
            return;
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
