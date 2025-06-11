module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: 'love',
  rules: {
    '@typescript-eslint/strict-boolean-expressions': 'off',
    "@typescript-eslint/no-non-null-assertion": "off"
  }
}
