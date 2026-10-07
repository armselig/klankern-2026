import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
import eslintConfigPrettier from 'eslint-config-prettier'

export default createConfigForNuxt({
  features: {
    stylistic: false,
  },
}).append(eslintConfigPrettier)
