import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';

// Load env variables and inject into process.env so that SSR/server-side code can access them
const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
Object.assign(process.env, env);

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro(),
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: [
      {
        find: "@tanstack/start-storage-context",
        replacement: path.resolve(__dirname, "src/lib/start-storage-context-browser.ts"),
        customResolver(source, importer, options) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((options as any)?.ssr) {
            return null;
          }
          return path.resolve(__dirname, "src/lib/start-storage-context-browser.ts");
        },
      },
    ],
    tsconfigPaths: true,
  },
});
