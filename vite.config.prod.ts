/**
 * Production Vite config — used exclusively by the Docker build.
 * Dev-only platform plugins (miaodaDevPlugin, monitorPlugin, etc.) are
 * intentionally excluded so the image has zero platform dependencies.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    // manualChunks must be a function in rolldown-vite v7+
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules/@radix-ui/") || id.includes("node_modules/lucide-react")) return "ui";
          if (id.includes("node_modules/react-router-dom") || id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "vendor";
        },
      },
    },
  },
});
