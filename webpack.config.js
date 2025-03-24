const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/client/index.js',
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'js/bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/client/index.html',
      filename: 'index.html',
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 9001,
    proxy: [
      {
        context: ['/socket.io'],
        target: 'http://localhost:4111',
        ws: true,
      },
    ],
  },
};
