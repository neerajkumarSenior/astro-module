import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node22",
  dts: true,
  clean: true,
  splitting: false,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  esbuildOptions(options) {
    options.alias = {
      "@": path.join(packageDir, "src"),
    };
  },
});
