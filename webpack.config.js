const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require("copy-webpack-plugin");
const path = require('path')

module.exports = {
    mode: 'development',
    entry: './src/app.ts',
    module:{
        rules:[
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    optimization:{
        splitChunks: {
            chunks: 'all'
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'LC JS Point and Line Series 3D Real-time Performance Test'
        }),
        new CopyPlugin({
            patterns: [
                {from:'public', to:''},
            ]
        })
    ]
}
