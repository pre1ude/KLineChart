---
name: "source-command-opsx-test"
description: "为变更涉及的源码变更生成单元测试并执行对应构建工具的测试命令"
---

# source-command-opsx-test

Use this skill when the user asks to run the migrated source command `opsx-test`.

## Command Template

为 OpenSpec 变更涉及的源码变更自动生成单元测试，追加到对应测试路径，然后执行检测到的测试命令并返回结果。

**Input**: `/opsx:test [变更名] [额外参数]`

示例：
- `/opsx:test` — 自动选变更，执行全量测试
- `/opsx:test add-auth` — 指定变更名
- `/opsx:test add-auth -Dtest=FlinkJobServiceTest` — 透传额外参数，缩小测试范围

---

## Steps

### 1. 选择目标变更

如果命令参数中提供了变更名，直接使用。否则：

```bash
openspec list --json
```

- 若只有一个活跃变更 → 自动选中并告知用户
- 若有多个活跃变更 → 使用 **AskUserQuestion tool** 让用户选择
- 若无任何活跃变更 → 提示"当前没有活跃变更"并退出

告知用户："正在为变更 `<name>` 生成测试"

---

### 2. 获取变更源码文件

执行：

```bash
git diff main...HEAD --name-only
```

根据检测到的语言/框架，从结果中识别需要生成测试的源码文件：
- 排除配置文件（`.yaml`、`.properties`、`.xml` 构建文件等）
- 排除文档文件（`.md`、`.txt` 等）
- 排除构建产物（`target/`、`dist/`、`build/` 目录下的文件）
- 排除已有测试文件（路径中含 `test`、`spec`、`__tests__` 等测试目录）
- 保留代码源文件（`.java`、`.ts`、`.js`、`.go`、`.py`、`.rs` 等）

- 若过滤后为空 → 提示"变更中无需生成测试的源码文件"并退出
- 将过滤后的文件列表保存备用

---

### 3. 检测构建工具

检查项目根目录，按以下优先级推断测试命令：

| 标志文件 | 测试命令 |
|---------|---------|
| `pom.xml` | `mvn test` |
| `build.gradle` / `build.gradle.kts` | `./gradlew test` |
| `package.json` | `npm test`（若有 `yarn.lock` 用 `yarn test`，`pnpm-lock.yaml` 用 `pnpm test`） |
| `go.mod` | `go test ./...` |
| `Cargo.toml` | `cargo test` |
| `pyproject.toml` / `requirements.txt` | `pytest` |
| 均未检测到 | 使用 **AskUserQuestion tool** 询问用户"请提供测试命令（如 `make test`）" |

---

### 4. 读取变更文件并生成单元测试

对步骤 2 的每个源码文件：

**a. 确定测试文件路径**

根据检测到的语言/框架约定推断测试文件路径：

- **Java**：`src/main/java/` → `src/test/java/`，文件名加 `Test` 后缀
  ```
  src/main/java/com/example/FooService.java → src/test/java/com/example/FooServiceTest.java
  ```
- **Go**：同目录，文件名加 `_test` 后缀
  ```
  internal/service/foo.go → internal/service/foo_test.go
  ```
- **TypeScript/JavaScript**：`src/` 下对应 `__tests__/` 目录，或同目录 `.test.ts` / `.spec.ts`
  ```
  src/service/foo.ts → src/service/__tests__/foo.test.ts
  ```
- **Python**：`tests/` 目录，文件名加 `test_` 前缀
  ```
  src/service/foo.py → tests/test_foo.py
  ```
- **其他语言**：根据该语言主流测试框架约定推断

**b. 读取源文件**

读取源文件，识别：
- 类/结构体/模块名
- 公开方法/函数签名
- 依赖注入或构造参数

**c. 生成测试内容**

- **测试文件不存在** → 创建完整测试文件（含必要的包声明、import、类/模块声明和测试方法）
- **测试文件已存在** → 读取已有文件，**追加**新的测试方法，不删除、不修改已有内容

根据检测到的语言和测试框架生成对应风格的测试代码：
- **Java**：JUnit 5（`@Test`、`@ExtendWith`）+ Mockito；Controller 层用 `@WebMvcTest` + `MockMvc`
- **TypeScript/JavaScript**：Jest 或 Vitest（`describe`、`it`、`expect`、`vi.mock`）
- **Go**：标准 `testing` 包 + testify（若已使用）
- **Python**：pytest + unittest.mock
- **其他语言**：按该语言主流测试框架生成

每个公开方法/函数至少生成一个正常路径测试，方法名遵循目标语言命名约定。

**d. 写入测试文件**

写入或更新对应测试文件。

---

### 5. 执行测试命令

构造测试命令：

```
<检测到的测试命令> <用户附加的额外参数>
```

执行命令，捕获完整输出。

---

### 6. 输出结果

**生成阶段输出：**

```
## Test: <change-name>

生成测试文件：
  ✓ src/test/java/.../FooServiceTest.java  （新建，3 个测试方法）
  ✓ src/service/__tests__/foo.test.ts  （已存在，追加 2 个方法）
```

**执行阶段输出（BUILD SUCCESS）：**

```
执行 <测试命令>...

[BUILD SUCCESS]
Tests run: 47, Failures: 0, Errors: 0, Skipped: 0
```

**执行阶段输出（BUILD FAILURE）：**

```
执行 <测试命令>...

[BUILD FAILURE]
Tests run: 47, Failures: 2, Errors: 0, Skipped: 0

失败详情：
  FAILED FooServiceTest.testCancelJob_success
    Expected: 200 OK
    but was:  500 INTERNAL_SERVER_ERROR
    at FooServiceTest.java:34
```

---

## Guardrails

- 根据语言/框架约定识别源码文件，不依赖特定路径前缀（如 `src/main/`）
- 追加模式：**绝不删除或覆盖**已有测试内容
- 额外参数直接透传给测试命令，不做解析或修改
- 若构建工具命令不存在，提示"未找到 <命令>，请确认已安装并在 PATH 中"
- 测试方法命名避免与已有方法重复（写入前检查方法名）
