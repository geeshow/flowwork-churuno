module.exports = {
  presets: [
    ['@babel/preset-env', { modules: 'auto' }],
    // Babel 8 keeps type-only imports by default; elide them like Babel 7 did
    ['@babel/preset-typescript', { onlyRemoveTypeImports: false }],
  ],
};
