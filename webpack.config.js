const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/main.js',
  output: {
    filename: 'monitor.js',
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
