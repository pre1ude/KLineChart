/// <reference types="vitest" />
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { playwright } from '@vitest/browser-playwright'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// 读取版本号
const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')
)
const version = pkg.version

// License Banner
const banner = `
/**
 * @license
 * @dm/kchart v${version}
 * Copyright © 2026 Innodealing Matrix Inc.
 */`.trim()

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const isProd = mode === 'production'

  return {
    // 定义全局常量替换
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    },

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
    },

    // esbuild: {
    //   banner
    // },

    // Vitest 配置
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/*.d.ts']
      },
      browser: {
        enabled: false,
        headless: false,
        // https://vitest.dev/config/browser/playwright
        provider: playwright(),
        instances: [
          { browser: 'chromium' },
        ],
      },
    }
  }
})
