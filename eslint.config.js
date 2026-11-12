const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  {
    ignores: ["dist/**", ".expo/**", "node_modules/**", "expo-env.d.ts", "uniwind-types.d.ts"],
  },
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
      },
    },
  },
  ...expoConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];
