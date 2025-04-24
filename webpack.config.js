const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: {
    monitor: './src/main.js',
    content: './content.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  // Enable source maps for easier debugging in development mode
  devtool: process.env.NODE_ENV === 'production' ? false : 'eval-source-map',
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      // JavaScript and TypeScript
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-typescript',
            ]
          }
        }
      }
    ]
  },
  plugins: [
    // Define environment variables that will be replaced during build
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.IS_PRODUCTION': JSON.stringify(process.env.NODE_ENV === 'production')
    })
  ],
  // Automatically poll for file changes - helps with WSL or mounted drives
  watchOptions: {
    poll: true,
    ignored: /node_modules/
  },
  optimization: {
    // Only minimize in production
    minimize: process.env.NODE_ENV === 'production',
  },
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
  }
};
