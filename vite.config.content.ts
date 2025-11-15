import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Separate build config for content script
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't clear dist, since main app builds there first
    cssCodeSplit: false, // Bundle all CSS into one file
    rollupOptions: {
      input: {
        content: "src/content.tsx",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          // Output CSS as content.css
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'content.css';
          }
          return assetInfo.name || 'asset';
        },
        format: "iife",
        inlineDynamicImports: true, // Bundle everything into single file
      },
    },
  },
});
