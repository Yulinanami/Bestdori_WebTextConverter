const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const sharp = require("sharp");

module.exports = {
  // 设置打包模式，生产模式会自动压缩代码
  mode: process.env.NODE_ENV === "production" ? "production" : "development",

  // 入口文件：CSS 和 JS 统一从这里引入，无需修改 JS 源码
  entry: [
    "./static/css/main.css",
    "./static/css/material-symbols.css",
    "./static/js/app.js",
  ],

  output: {
    // 打包后的文件名
    filename: "bundle.js",
    // 打包输出目录
    path: path.resolve(__dirname, "static/dist"),
    // 每次构建前清理原有的 dist 目录
    clean: true,
  },

  resolve: {
    // 解析别名：与原来 index.html 中的 importmap 对应
    alias: {
      "@components": path.resolve(__dirname, "static/js/components"),
      "@managers": path.resolve(__dirname, "static/js/managers"),
      "@services": path.resolve(__dirname, "static/js/services"),
      "@models": path.resolve(__dirname, "static/js/models"),
      "@utils": path.resolve(__dirname, "static/js/utils"),
      "@editors": path.resolve(__dirname, "static/js/editors"),
      "@mixins": path.resolve(__dirname, "static/js/mixins"),
      "@config": path.resolve(__dirname, "static/js/config"),
      "@i18n": path.resolve(__dirname, "static/js/i18n"),
      immer: path.resolve(__dirname, "static/js/lib/immer.production.mjs"),
    },
    // 解析支持的扩展名
    extensions: [".js", ".mjs", ".json"],
  },

  module: {
    rules: [
      {
        // 处理 JavaScript 文件
        test: /\.js$/,
        // 排除压缩库和 node_modules，避免不必要的降级编译
        exclude: /node_modules|lib/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
          {
            // 编译时自动替换头像路径：PNG → WebP，原始目录 → dist 目录
            // 这样 JS 源码无需任何修改，Webpack 在打包时动态完成路径重写
            loader: "string-replace-loader",
            options: {
              search: "/static/images/avatars/\\$\\{(\\w+)\\}\\.png",
              replace: "/static/dist/images/avatars/$${$1}.webp",
              flags: "g",
            },
          },
        ],
      },
      {
        // 处理 CSS 文件（由 style-loader 动态注入到页面中）
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },

  // 生成 SourceMap，方便在浏览器的开发者工具中调试原始代码
  devtool: "source-map",

  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        // 复制非头像的静态图片（如 favicon.svg 等）原样搬运
        {
          from: path.resolve(__dirname, "static/images"),
          to: path.resolve(__dirname, "static/dist/images"),
          globOptions: {
            ignore: ["**/avatars/**"],
          },
        },
        // 将 avatars 目录下的 PNG 转换为 WebP 格式后输出
        {
          from: path.resolve(__dirname, "static/images/avatars"),
          to({ absoluteFilename }) {
            // 将输出文件名的 .png 扩展名替换为 .webp
            const basename = path.basename(absoluteFilename, ".png");
            return path.resolve(
              __dirname,
              "static/dist/images/avatars",
              `${basename}.webp`,
            );
          },
          filter: (resourcePath) => resourcePath.endsWith(".png"),
          transform: {
            transformer(content) {
              return sharp(content).webp({ quality: 80 }).toBuffer();
            },
          },
        },
      ],
    }),
  ],
};
