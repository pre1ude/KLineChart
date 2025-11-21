# TypeScript 大型项目 ESLint 最佳实践

## 🎯 配置概述

已应用业界认可的 TypeScript 大型项目 ESLint 最佳实践配置。

## 📋 配置分类

### 1. 类型安全 (Type Safety)

#### 核心规则

| 规则 | 设置 | 说明 |
|------|------|------|
| `no-explicit-any` | warn | 警告使用 any（不完全禁止） |
| `no-unsafe-*` | off | 关闭过于严格的类型检查 |
| `consistent-type-assertions` | error | 统一使用 `as` 断言 |
| `no-unnecessary-type-assertion` | error | 禁止不必要的类型断言 |

#### 最佳实践

```typescript
// ✅ 推荐
const value = data as string
const result: number = getValue()

// ⚠️ 警告但允许
const temp: any = unknownData

// ❌ 错误
const value = <string>data  // 使用 as 代替
```

### 2. 类型导入 (Type Imports)

#### 规则配置

```javascript
'@typescript-eslint/consistent-type-imports': ['error', {
  prefer: 'type-imports',
  fixStyle: 'inline-type-imports'
}]
```

#### 最佳实践

```typescript
// ✅ 推荐 - 内联类型导入
import { type User, createUser } from './user'

// ❌ 错误 - 混合导入
import { User, createUser } from './user'

// ✅ 也可以 - 单独类型导入
import type { User } from './user'
import { createUser } from './user'
```

### 3. 命名约定 (Naming Convention)

#### 规则配置

| 类型 | 格式 | 示例 |
|------|------|------|
| 变量 | camelCase, UPPER_CASE, PascalCase | `userName`, `MAX_SIZE`, `UserData` |
| 函数 | camelCase | `getUserName()` |
| 类/接口/类型 | PascalCase | `User`, `IUser`, `UserType` |
| 枚举成员 | PascalCase, UPPER_CASE | `Status.Active`, `Color.RED` |
| 私有成员 | _camelCase | `_privateMethod()` |

#### 最佳实践

```typescript
// ✅ 推荐
class UserService {
  private _cache: Map<string, User>

  getUserById(id: string): User {
    return this._cache.get(id)
  }
}

// 常量
const MAX_RETRY_COUNT = 3
const apiUrl = 'https://api.example.com'

// 类型
interface UserProfile {
  name: string
  age: number
}

// 枚举
enum Status {
  Active,
  Inactive
}
```

### 4. 未使用变量 (Unused Variables)

#### 规则配置

```javascript
'@typescript-eslint/no-unused-vars': ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
  destructuredArrayIgnorePattern: '^_'
}]
```

#### 最佳实践

```typescript
// ✅ 推荐 - 使用 _ 前缀忽略
function handleEvent(_event: Event, data: Data) {
  console.log(data)
}

// ✅ 推荐 - 解构时忽略
const [first, , third] = array
const [_ignored, ...rest] = array

// ✅ 推荐 - 错误处理
try {
  doSomething()
} catch (_error) {
  // 忽略错误
}
```

### 5. Promise 处理 (Promise Handling)

#### 规则配置

```javascript
'@typescript-eslint/no-floating-promises': 'off',
'@typescript-eslint/no-misused-promises': ['error', {
  checksVoidReturn: false
}]
```

#### 最佳实践

```typescript
// ✅ 推荐 - 正确处理 Promise
async function loadData() {
  try {
    const data = await fetchData()
    return data
  } catch (error) {
    console.error(error)
  }
}

// ✅ 推荐 - void 返回
button.addEventListener('click', async () => {
  await handleClick()
})

// ✅ 推荐 - 显式忽略
void fetchData()  // 明确表示忽略 Promise
```

### 6. 代码风格 (Code Style)

#### 缩进和空格

```typescript
// ✅ 推荐 - 2 空格缩进
function example() {
  if (condition) {
    doSomething()
  }
}

// ✅ 推荐 - 对象空格
const obj = { key: 'value' }

// ✅ 推荐 - 数组无空格
const arr = [1, 2, 3]
```

#### 引号和分号

```typescript
// ✅ 推荐 - 单引号
const str = 'hello'
const template = `hello ${name}`

// ✅ 推荐 - 不使用分号
const value = 42
const result = getValue()
```

#### 箭头函数

```typescript
// ✅ 推荐 - 按需括号
const single = x => x * 2
const multiple = (x, y) => x + y
const async = async x => await process(x)

// ✅ 推荐 - 函数空格
function named() {}
const anonymous = function () {}
const arrow = () => {}
```

### 7. JavaScript 最佳实践

#### 变量声明

```typescript
// ✅ 推荐
const immutable = 'value'
let mutable = 0

// ❌ 错误
var oldStyle = 'no'
```

#### 对象和数组

```typescript
// ✅ 推荐 - 对象简写
const name = 'John'
const user = { name, age: 30 }

// ✅ 推荐 - 箭头函数
const double = x => x * 2

// ✅ 推荐 - 模板字符串
const message = `Hello ${name}`

// ✅ 推荐 - 展开运算符
const newArray = [...oldArray, newItem]
const newObject = { ...oldObject, newKey: 'value' }
```

#### 控制流

```typescript
// ✅ 推荐 - 提前返回
function process(data) {
  if (!data) return null
  return transform(data)
}

// ✅ 推荐 - 简化条件
const result = condition ? valueA : valueB

// ✅ 推荐 - 严格相等
if (value === 42) {}
if (value !== null) {}
```

## 🚀 使用指南

### 运行 Lint

```bash
# 检查所有文件
npm run lint

# 自动修复
npm run lint -- --fix

# 检查特定文件
npx eslint src/path/to/file.ts
```

### Git Hooks

项目已配置 Husky，每次提交前自动运行 lint：

```bash
git commit -m "your message"
# 自动运行: npm run lint
```

### IDE 集成

#### VS Code

安装 ESLint 扩展后，配置 `.vscode/settings.json`：

```json
{
  "eslint.enable": true,
  "eslint.validate": [
    "javascript",
    "typescript"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 📊 规则统计

### 启用的规则

| 类别 | 数量 | 说明 |
|------|------|------|
| TypeScript 类型安全 | 15+ | 类型检查和断言 |
| TypeScript 最佳实践 | 10+ | 代码质量和一致性 |
| 代码风格 | 20+ | 格式和风格统一 |
| JavaScript 最佳实践 | 15+ | 现代 JS 特性 |
| **总计** | **60+** | 全面的代码质量保障 |

### 关闭的规则

| 规则 | 原因 |
|------|------|
| `no-unsafe-*` | 过于严格，影响开发效率 |
| `explicit-function-return-type` | TypeScript 可以推断 |
| `no-floating-promises` | 某些场景需要忽略 Promise |
| `strict-boolean-expressions` | 过于严格 |

## 🎯 最佳实践建议

### 1. 渐进式采用

```bash
# 先修复自动可修复的问题
npm run lint -- --fix

# 然后逐步修复剩余问题
npm run lint
```

### 2. 团队协作

- 所有团队成员使用相同的 ESLint 配置
- 在 CI/CD 中集成 lint 检查
- 定期更新 ESLint 和插件版本

### 3. 性能优化

```javascript
// 使用 project: true 自动查找 tsconfig.json
parserOptions: {
  project: true,
  tsconfigRootDir: import.meta.dirname
}
```

### 4. 自定义规则

如果需要调整规则，在 `eslint.config.js` 中修改：

```javascript
rules: {
  // 调整规则严格程度
  '@typescript-eslint/no-explicit-any': 'off',  // 完全关闭
  '@typescript-eslint/no-explicit-any': 'warn', // 警告
  '@typescript-eslint/no-explicit-any': 'error' // 错误
}
```

## 📚 参考资源

- [TypeScript ESLint](https://typescript-eslint.io/)
- [ESLint 官方文档](https://eslint.org/)
- [@stylistic/eslint-plugin](https://eslint.style/)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

## 🎉 总结

当前配置特点：

- ✅ 基于业界最佳实践
- ✅ 平衡严格性和开发效率
- ✅ 全面的类型安全检查
- ✅ 统一的代码风格
- ✅ 适合大型 TypeScript 项目
- ✅ 易于维护和扩展

**配置已完成，可以立即使用！**

```bash
npm run lint
```
