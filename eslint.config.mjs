import next from "eslint-config-next";
import nextTypescript from "eslint-config-next/typescript";

/**
 * The isomorphic core must run unchanged in three places: the browser (instant
 * feedback while typing), a Web Worker (layout), and the server (`/api/render`).
 * If it ever picks up a DOM, React or Node dependency, client and server output
 * silently diverge — the canvas and the exported PNG stop agreeing.
 *
 * `src/core/shapes` is deliberately exempt: it is the React boundary.
 */
const ISOMORPHIC_CORE = [
  "src/core/lang/**/*.ts",
  "src/core/ir/**/*.ts",
  "src/core/registry/**/*.ts",
  "src/core/complete/**/*.ts",
  "src/core/layout/**/*.ts",
  "src/core/render/**/*.ts",
  "src/core/export/**/*.ts",
];

const FORBIDDEN_IN_CORE = [
  { group: ["react", "react-dom", "react/**", "react-dom/**"], message: "The isomorphic core must not depend on React. Put rendering in src/core/shapes." },
  { group: ["next", "next/**"], message: "The isomorphic core must not depend on Next.js — it also runs in a worker and on the server." },
  { group: ["@xyflow/react", "@xyflow/react/**"], message: "React Flow is a rendering concern. Keep it in src/core/shapes or src/components." },
  { group: ["node:*"], message: "The isomorphic core must not use Node built-ins — it also runs in the browser." },
  { group: ["fs", "path", "crypto", "os", "child_process"], message: "The isomorphic core must not use Node built-ins — it also runs in the browser." },
];

const config = [
  ...next,
  ...nextTypescript,
  {
    // `public/` holds vendored third-party assets, not source.
    ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"],
  },
  {
    files: ISOMORPHIC_CORE,
    rules: {
      "no-restricted-imports": ["error", { patterns: FORBIDDEN_IN_CORE }],
    },
  },
];

export default config;
