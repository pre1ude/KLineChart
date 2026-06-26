---
name: openspec-parallel
description: AI 推断 OpenSpec 变更任务的并行分组，经用户确认后用 worktree 并发执行，顺序合并回主工作区。Use when the user wants to implement tasks in parallel using multiple agents.
license: MIT
compatibility: Requires openspec CLI. Requires git worktree support.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.2.0"
---

将 OpenSpec 变更中的待办任务按依赖关系分组，经用户确认后为每个任务创建独立 git worktree，并发启动 subagent 实现，完成后顺序合并回主工作区。

**Input**: 可选指定变更名。

---

## Steps

### 1. 选择目标变更

如果调用时提供了变更名，直接使用。否则：

```bash
openspec list --json
```

- 若只有一个活跃变更 → 自动选中并告知用户
- 若有多个活跃变更 → 使用 **AskUserQuestion tool** 让用户选择
- 若无任何活跃变更 → 提示"当前没有活跃变更"并退出

---

### 2. 读取待办任务

读取变更目录下的 `tasks.md`：

```
openspec/changes/<name>/tasks.md
```

提取所有标记为 `- [ ]` 的待办任务，记录：
- 任务编号（如 `1.1`、`2.3`）
- 任务描述文本

若所有任务均已完成（`[x]`） → 提示"所有任务已完成，可执行 `/opsx:archive`"并退出。

---

### 3. AI 推断并行分组

分析所有待办任务的描述，推断哪些任务可以安全并行执行：

**并行判断原则：**
- 修改**不同文件/模块**的任务可以并行（放入同一组）
- 有**逻辑依赖**（如 A 的输出是 B 的输入）的任务必须串行（放入不同组，先后执行）
- 无法判断是否冲突时，保守地放入不同组

**退化情况：**
若所有任务均涉及同一文件或无法安全并行 → 告知用户：
```
未发现可并行的任务，建议使用 /opsx:apply 进行串行实现。
```
并退出。

**分组输出示例：**
```
Group 1（并行执行）：
  - task 1.1: 创建 review.md
  - task 2.1: 创建 test.md
  - task 3.1: 创建 parallel.md

Group 2（Group 1 完成后并行执行）：
  - task 1.2: 实现 git diff 获取文件列表
  - task 2.2: 实现源码文件过滤逻辑

顺序执行：
  - task 3.10: 所有组完成后的汇总输出
```

---

### 4. 展示分组方案并等待用户确认

使用 **AskUserQuestion tool** 展示分组方案，询问用户是否确认执行。

选项：
- **确认执行** → 继续
- **取消** → 退出，不做任何修改

---

### 5. 按组执行（循环直到所有组完成）

对每个并行组，执行以下流程：

#### 5a. 为组内每个任务创建 git worktree

```bash
git worktree add .Codex/worktrees/<change>-task-<编号> -b worktree/<change>-task-<编号>
```

例如：
```bash
git worktree add .Codex/worktrees/add-auth-task-1-1 -b worktree/add-auth-task-1-1
```

#### 5b. 并发启动 subagent

使用 **Agent tool** 为组内每个任务**同时**启动一个 subagent（在单条消息中发起多个 Agent tool 调用以实现并发）。

每个 subagent 的 prompt 包含：
- 当前任务的完整描述
- `design.md` 的完整内容（作为上下文）
- 该任务对应的 worktree 路径
- 明确指令：**只实现本任务，不修改其他文件**

Subagent prompt 模板：
```
你正在一个独立的 git worktree 中工作，路径为：<worktree路径>

当前任务：<任务描述>

设计背景（design.md）：
<design.md 完整内容>

要求：
1. 切换到 worktree 目录后实现上述任务
2. 只修改与本任务直接相关的文件
3. 完成后确认文件已保存
```

等待**组内所有 subagent 全部完成**后再进入下一步。

#### 5c. 顺序合并各 worktree

按固定顺序（任务编号升序）逐一合并：

```bash
git merge worktree/<change>-task-<编号> --no-edit
```

**merge 成功：**
```bash
git worktree remove .Codex/worktrees/<change>-task-<编号>
git branch -d worktree/<change>-task-<编号>
```
输出：`✓ task-<编号> 合并成功`

**merge 冲突：**
```bash
git merge --abort
```
暂停执行，输出：
```
## 合并冲突，需要手动处理

task-<编号> 合并时发生冲突：
  冲突文件：
    - src/FooService.java

请手动解决冲突后，告知我继续或退出。
解决冲突后运行 `git add <文件>` 并 `git merge --continue`。

worktree 路径：.Codex/worktrees/<change>-task-<编号>
```

等待用户处理后继续，或用户选择退出。

#### 5d. 更新 tasks.md

将本组所有已成功合并的任务在 `tasks.md` 中标记为 `[x]`。

---

### 6. 所有组完成后输出汇总

```
## Parallel 执行完成

**变更：** <change-name>
**进度：** N/N tasks complete ✓

### 本次完成
- [x] task 1.1: ...
- [x] task 1.2: ...
...

所有任务完成！运行 `/opsx:archive` 归档本次变更。
```

---

## Guardrails

- 每次启动 subagent 前必须先创建对应 worktree
- **绝不跳过用户确认步骤**（步骤 4）
- merge 冲突时必须暂停，不得强制合并或丢弃任何一方的修改
- worktree 只在 merge 成功后删除，冲突时保留以便用户检查
- 若用户在冲突后选择退出，已合并的任务保持 `[x]`，未合并的保持 `[ ]`，用户可后续用 `/opsx:apply` 继续串行完成
- subagent 的 prompt 必须包含 worktree 路径，确保其在正确的目录下工作
