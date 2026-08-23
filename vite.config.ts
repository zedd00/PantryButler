import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import fs from "fs";

// Dev middleware: serve setup seed files (e.g. /setup/nutrition_foods.json)
// from the repo-level `setup/` dir, mirroring the production static route.
function setupSeedMiddleware(): Plugin {
  const setupDir = path.resolve(__dirname, "setup");
  return {
    name: "setup-seed-middleware",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/setup/")) {
          const filePath = path.join(setupDir, req.url.slice("/setup/".length));
          // Path containment: reject any request that resolves outside the
          // setup directory (e.g. /setup/../../package.json must not serve the
          // repo's package.json).
          if (filePath.startsWith(setupDir + path.sep) &&
            fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader("Content-Type", "application/json");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Removed miaodaDevPlugin – not needed for self‑hosted development
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
    setupSeedMiddleware(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});