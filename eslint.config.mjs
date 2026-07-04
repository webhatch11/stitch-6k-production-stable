import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Throwaway developer scratch scripts and one-off manual test harnesses.
    // Not shipped, not imported by the app — excluded from lint.
    "scratch/**",
    "refactor.js",
    "tests/concurrency/**",
    "**/*.bak",
    "**/*.bak2",
    "**/*.bak3",
  ]),
]);

export default eslintConfig;
