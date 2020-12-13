module.exports = {
  extends: '@josselinbuils/eslint-config-typescript',
  overrides: [
    {
      files: '**/*.js',
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
  ],
  rules: {
    camelcase: 'off',
  },
};
