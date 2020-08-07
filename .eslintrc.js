module.exports = {
  root: true,
  extends: ['@webpack-contrib/eslint-config-webpack', 'prettier'],
  rules: {
    'global-require': 0,
    'import/no-unresolved': [2, { ignore: ['tsterser', 'terser'] }],
  },
};
