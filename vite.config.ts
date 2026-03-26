/// <reference types="vitest" />
import { playwright } from '@vitest/browser-playwright'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// 读取版本号
const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')
)
const version = pkg.version

const bundledLicenseFile = 'licenses/dependencies.md'

// License Banner
const banner = `
/**
 * @license
 * @dm/kchart v${version}
 * Copyright © 2026 Innodealing Matrix Inc.
 * Bundled dependency licenses: dist/${bundledLicenseFile}
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

      // 生成打包依赖许可证清单
      license: {
        fileName: bundledLicenseFile
      },

      // 目标环境
      target: 'es2020',

      // Source map
      sourcemap: isDev,

      // 代码压缩
      minify: isProd ? 'oxc' : false,

      // Rolldown 配置
      rolldownOptions: {
        // 输出配置
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].js',
          exports: 'named',
          // postBanner: banner
        },

        // Tree-shaking 优化
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false
        }
      }
    },

    // 解析配置
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src')
      }
    },

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
