const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
    },
    ignores: ["dist/*", ".expo/*", "node_modules/*", "expo-env.d.ts", "uniwind-types.d.ts"],
  },
];
