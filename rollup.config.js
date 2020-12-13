const typescript = require('@rollup/plugin-typescript');

module.exports = [
  {
    input: './src/ALACDecoder.ts',
    output: {
      dir: 'dist',
      format: 'cjs',
    },
    plugins: [typescript()],
  },
];
