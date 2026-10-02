import { defineConfig } from 'vite';

/* 先把预览页跑起来(一个普通 Vite 应用);
   等美术与手感定下来之后,再加一份"单文件 IIFE"构建,产物直接丢进
   tuagfey-blog/static/assets/gd/ 给第三张盘用。 */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
  },
});
