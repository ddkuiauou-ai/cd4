// .eslintrc.mjs
/** @type {import('eslint').ESLint.ConfigData} */
export default {
  extends: ["next/core-web-vitals"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-empty-interface": "error",
    "@typescript-eslint/no-empty-object-type": "error",
    "prefer-const": "error",
  },
};
