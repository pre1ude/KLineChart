# 构建脚本说明

## 迁移到 Vite

此目录中的旧构建脚本已被 Vite 替代。

### 旧脚本（已弃用）

以下脚本已不再使用，可以安全删除：

- `build.js` - Rollup 构建主脚本
- `build-esm.js` - ESM 格式构建
- `build-cjs.js` - CommonJS 格式构建
- `build-umd.js` - UMD 格式构建
- `config.js` - Rollup 配置
- `utils.js` - 工具函数
- `clean.js` - 清理脚本

### 新的构建方式

所有构建现在通过 `vite.config.ts` 配置，使用以下命令：

```bash
# 生产构建
npm run build

# 开发构建
npm run build:dev

# 清理输出目录
npm run clean
```

### 迁移指南

详见项目根目录的 `MIGRATION_TO_VITE.md` 文件。
