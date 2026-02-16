import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/main/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["src/renderer/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    rules: {
      curly: ["error", "all"],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
];
