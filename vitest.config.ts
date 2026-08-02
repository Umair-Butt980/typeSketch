import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": src },
  },
  test: {
    projects: [
      {
        resolve: { alias: { "@": src } },
        test: {
          name: "core",
          environment: "node",
          include: ["src/core/{lang,ir,registry,layout,export}/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: { "@": src } },
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "src/core/shapes/**/*.test.{ts,tsx}",
            "src/{app,components,lib}/**/*.test.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
