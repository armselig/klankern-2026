import { createConfigForNuxt } from "@nuxt/eslint-config/flat";
import eslintConfigPrettier from "eslint-config-prettier";

export default createConfigForNuxt({
  features: {
    stylistic: false,
  },
})
  .append(eslintConfigPrettier)
  .append({
    files: ["**/*.vue"],
    rules: {
      // Nuxt auto-imports components, so none is registered in the file;
      // without `registeredComponentsOnly: false` the rule checks nothing.
      "vue/component-name-in-template-casing": [
        "error",
        "kebab-case",
        { registeredComponentsOnly: false },
      ],
    },
  });
