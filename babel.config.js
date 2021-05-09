const plugins = [
  'inline-react-svg',
  ['module-resolver', {
    'root': ['./src'],
    'alias': {
      '$components': './src/components',
      '$icons': './src/icons',
      '$hooks': './src/hooks'
    }
  }]
];

const presets = [
  ['@babel/env', {
    corejs: 3,
    useBuiltIns: 'usage'
  }],
  '@babel/preset-react'
];

module.exports = { plugins, presets };