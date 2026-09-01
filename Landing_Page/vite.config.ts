import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    // Resolves the "@/*" -> "./src/*" alias declared in tsconfig.json.
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR
      // error wrapper). nitro/vite builds from this.
      server: { entry: "server" },
    }),
    // Bundles the server output. The deployment preset is auto-detected from the
    // host; set NITRO_PRESET (e.g. cloudflare_module) to target one explicitly.
    nitro(),
    // Must come after tanstackStart().
    viteReact(),
  ],
  // Keep a single copy of React and the TanStack runtimes so hooks and router
  // context are not split across duplicate module instances.
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
});
