const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");

module.exports = [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "eslint.config.js", "vitest.config.ts"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  }
];
