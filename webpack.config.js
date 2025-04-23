const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/main.js',
  output: {
    filename: 'monitor.js',
    path: path.resolve(__dirname, '.'),
  },
  // Enable source maps for easier debugging
  devtool: process.env.NODE_ENV === 'production' ? false : 'eval-source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  // Automatically poll for file changes - helps with WSL or mounted drives
  watchOptions: {
    poll: true,
    ignored: /node_modules/
  }
}; 