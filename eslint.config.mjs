import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import path from "path";

//https://eslint.org/docs/latest/use/configure/migration-guide#using-eslintrc-configs-in-flat-config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname
});

const commonRules = {
  "react/prop-types": "off",
  "@typescript-eslint/ban-ts-comment": "off",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      "argsIgnorePattern": "^_[^_].*$|^_$",
      "varsIgnorePattern": "^_[^_].*$|^_$",
      "caughtErrorsIgnorePattern": "^_[^_].*$|^_$"
    }
  ]
};

const common = {rules: commonRules};

export default [
  ...tseslint.config({
    files: ["client/**/*.{ts,tsx,js,jsx}", "shared/**/*.ts"],
    ignores: ["client/public/**/*.{ts,tsx,js,jsx}", "client/.next/**/*.{ts,tsx,js,jsx}"],
    extends: [
      pluginJs.configs.recommended,
      pluginReact.configs.flat["jsx-runtime"],
      ...tseslint.configs.recommendedTypeChecked,
      // ...compat.extends("plugin:@next/next/recommended"), there is a bug in this plugin lmao
      common
    ],
    settings: {
      react: {
        version: "18"
      },
      next: {
        rootDir: "client"
      }
    },
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: { projectService: true },
    }
  }, {
    files: ["server/scripts/**.{ts,js}", "shared/*.ts"],
    extends: [
      pluginJs.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      common
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true },
    },
  }, )
];