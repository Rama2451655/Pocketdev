// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Support for .cjs files needed by some packages
    sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs', 'mjs'],

    // Alias support matching tsconfig paths
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@screens': path.resolve(__dirname, 'src/screens'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@theme': path.resolve(__dirname, 'src/theme'),
      '@navigation': path.resolve(__dirname, 'src/navigation'),
    },

    // Node.js polyfills for isomorphic-git
    extraNodeModules: {
      stream: require.resolve('readable-stream'),
      path: require.resolve('path-browserify'),
      events: require.resolve('events'),
      buffer: require.resolve('buffer'),
    },
  },

  transformer: {
    // Required for react-native-svg and other inline requires
    inlineRequires: true,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },

  server: {
    // Faster HMR
    enhanceMiddleware: (middleware) => middleware,
  },
};

module.exports = mergeConfig(defaultConfig, config);
