module.exports = {
  extends: 'standard',
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2022, // or latest
    sourceType: 'module',
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-env'],
      plugins: ['@babel/plugin-syntax-import-assertions']
    }
  },
  rules: {
    'space-before-function-paren': [
      'error',
      {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }
    ]
  }
}
