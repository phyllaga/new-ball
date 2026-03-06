# 合约盈亏计算器

这是一个基于React的加密货币合约交易盈亏计算工具。

## 运行步骤

1. **安装依赖**

   ```bash
   npm install
   ```

2. **启动开发服务器**

   ```bash
   npm start
   ```
   
   启动后，自动打开浏览器访问 http://localhost:3000 
   
   如果浏览器没有自动打开，请手动访问上述地址

3. **构建生产版本**

   ```bash
   npm run build
   ```
   
   构建完成后，生产文件会保存在 `build` 目录中。
   
   可以通过以下方式预览构建后的应用：
   ```bash
   npx serve -s build
   ```
   
   然后访问命令行中显示的地址（通常是 http://localhost:5000）

## 注意事项

- 确保您已安装最新版本的 Node.js（推荐 v14 或更高版本）
- 如果遇到端口冲突，可以通过设置环境变量更改端口：`PORT=3001 npm start`
