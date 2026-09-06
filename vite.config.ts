import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // `compiler: true` enables the Rust (Oxc) React Compiler transform.
  plugins: [react({ compiler: true })],
});
