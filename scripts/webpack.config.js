/**
 * Unified Webpack Configuration
 * 
 * This file provides webpack configuration for both:
 * 1. The main extension (default)
 * 2. The MCP client (when BUILD_TARGET=mcp)
 */

const path = require('path');
const webpack = require('webpack');

// Root directory is the parent of the scripts directory
const rootDir = path.resolve(__dirname, '..');
const packageJson = require('../package.json');

// Get the build target from environment variable
const buildTarget = process.env.BUILD_TARGET || 'extension';

// Common configuration shared between both builds
const commonConfig = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'inline-source-map',
  module: {
    rules: [
      // JavaScript
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      // CSS (for extension only)
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      // Assets (for extension only)
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    // Define environment variables that will be replaced during build
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.IS_PRODUCTION': JSON.stringify(process.env.NODE_ENV === 'production'),
      'process.env.VERSION': JSON.stringify(packageJson.version)
    })
  ],
  watchOptions: {
    poll: process.env.WEBPACK_WATCH_POLL ? true : false,
    ignored: /node_modules/
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
  },
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
    maxAssetSize: 500000, // 500KB
    maxEntrypointSize: 500000
  }
};

// Extension-specific configuration
const extensionConfig = {
  ...commonConfig,
  entry: {
    'src/background/background': './src/background/background.js',
    'src/content/content': './src/content/content.js',
    'src/content/mcp-bridge': './src/content/mcp-bridge.js',
    'src/page/monitor': './src/page/monitor.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(rootDir, 'dist'),
    clean: true
  },
  resolve: {
    extensions: ['.js'],
    alias: {
      '@': path.resolve(rootDir, 'src'),
      '@common': path.resolve(rootDir, 'src/common'),
      '@background': path.resolve(rootDir, 'src/background'),
      '@content': path.resolve(rootDir, 'src/content'),
      '@page': path.resolve(rootDir, 'src/page'),
      '@mcpClient': path.resolve(rootDir, 'src/mcpClient')
    }
  }
};

// MCP client-specific configuration
const mcpClientConfig = {
  ...commonConfig,
  entry: path.resolve(rootDir, 'src/mcpClient/mcp-browser-entry.js'),
  output: {
    filename: 'mcp-browser-generated.js',
    path: path.resolve(rootDir, 'src/mcpClient'),
    library: {
      name: 'MCPClient',
      type: 'umd',
      export: 'default',
      umdNamedDefine: true
    },
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      util: require.resolve('util/'),
      assert: require.resolve('assert/'),
    }
  },
  plugins: [
    ...commonConfig.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  ]
};

// Export the configuration based on build target
module.exports = buildTarget === 'mcp' ? mcpClientConfig : extensionConfig;
 