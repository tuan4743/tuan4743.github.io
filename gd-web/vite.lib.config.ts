import { defineConfig } from 'vite';
import path from 'node:path';

/* 给博客用的单文件构建:把 Phaser + 我们的代码打成一个 IIFE(约 375 KB gzip),
   直接写进 tuagfey-blog/static/assets/gd/gd.js —— 页面用 <script defer> 引它就行。
   ★ emptyOutDir: true 会把 static/assets/gd/ 整个清空:那个目录只放构建产物,
     别往里塞数据文件(通关输入卷放在隔壁 static/assets/gd-tape.json)。 */
export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, '..', 'static', 'assets', 'gd'),
    emptyOutDir: true,
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src', 'embed.ts'),
      name: 'GDWeb',
      formats: ['iife'],
      fileName: () => 'gd.js',
    },
  },
});
