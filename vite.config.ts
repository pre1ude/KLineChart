import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// 读取版本号
const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')
)
const version = pkg.version

// 环境变量
const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

// License Banner
const banner = `
/**
 * @license
 * KLineChart v${version}
 * Copyright (c) 2019 lihu.
 * Licensed under Apache License 2.0 https://www.apache.org/licenses/LICENSE-2.0
 */`.trim()

export default defineConfig({
  // 插件配置
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
      copyDtsFiles: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**'],
      staticImport: true,
      clearPureImport: true,
      logLevel: 'error'
    })
  ],

  // 构建配置
  build: {
    // 库模式
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js'
    },

    // 输出目录
    outDir: 'dist',
    emptyOutDir: true,

    // 目标环境
    target: 'es2020',

    // Source map
    sourcemap: isDev,

    // 代码压缩
    minify: isProd ? 'terser' : false,
    terserOptions: isProd ? {
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.trace'],
        passes: 2
      },
      format: {
        comments: false,
        ecma: 2020
      },
      mangle: {
        safari10: true
      }
    } : undefined,

    // CSS 配置
    cssCodeSplit: false,

    // 性能优化
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: !isDev,

    // Rollup 配置
    rollupOptions: {
      // 输出配置
      output: {
        banner,
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        exports: 'named',
        generatedCode: {
          constBindings: true
        }
      },

      // Tree-shaking 优化
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    }
  },

  // 解析配置
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src')
    }
  }
})
