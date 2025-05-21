module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ['airbnb-base', 'eslint:recommended', 'plugin:node/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn', // Allow console logs but warn
    'no-debugger': 'error', // Strictly forbid debugger
    'import/prefer-default-export': 'off',
    'node/no-unsupported-features/es-syntax': 'off', // Allow ES modules (import/export)
    'node/no-missing-import': 'off', // Ignore missing import for ES Modules
    'node/no-unpublished-import': 'off',
    'node/no-extraneous-import': 'off',
    'comma-dangle': ['error', 'never'],
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    'no-param-reassign': ['error', { props: false }],
    'operator-linebreak': 'off',
    'newline-per-chained-call': 'off',
    'no-plusplus': 'off',
    'node/no-unsupported-features/node-builtins': 'off'
  }
};
