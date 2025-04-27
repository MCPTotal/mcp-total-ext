const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './browser-mcp-client.js',
  output: {
    filename: 'mcp-browser.js',
    path: path.resolve(__dirname, '../src/background/generated'),
    library: {
      name: 'MCPClient',
      type: 'umd',
      export: 'default',
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "util": require.resolve("util/"),
      "events": require.resolve("events/"),
      "assert": require.resolve("assert/"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "url": require.resolve("url/"),
      "os": require.resolve("os-browserify/browser"),
      "path": require.resolve("path-browserify"),
      "fs": false,
      "net": false,
      "tls": false,
      "zlib": require.resolve("browserify-zlib"),
      "crypto": require.resolve("crypto-browserify"),
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: "defaults" }],
              '@babel/preset-typescript'
            ],
            plugins: [
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-transform-runtime'
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    // Handle Node.js specific environment variables
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
  ],
  optimization: {
    minimize: true
  }
}; 