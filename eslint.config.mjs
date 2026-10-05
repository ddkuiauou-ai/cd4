import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", ".next-docs/**", ".kilo/**"] },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    // Compiler adoption is a later phase. Keep its new diagnostics visible
    // while retaining errors for hook ordering and the existing source rules.
    rules: {
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    files: ["tests/**/*.cjs", "scripts/**/*.js"],
    languageOptions: {
      globals: { require: "readonly", module: "readonly", __dirname: "readonly", process: "readonly", Buffer: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
