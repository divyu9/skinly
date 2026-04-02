import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/convex": path.resolve(__dirname, "./convex"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-convex': ['convex'],
          'vendor-clerk': ['@clerk/clerk-react'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select',
                        '@radix-ui/react-dropdown-menu'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['motion'],
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
