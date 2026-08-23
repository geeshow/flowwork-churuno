module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    // Babel 8 keeps type-only imports by default; elide them like Babel 7 did
    ['@babel/preset-typescript', { onlyRemoveTypeImports: false }]
  ]
};
