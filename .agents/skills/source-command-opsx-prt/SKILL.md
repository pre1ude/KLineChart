---
name: "source-command-opsx-prt"
description: "将 Parallel（并行实现）、Review（代码审查）、Test（单元测试）串联执行"
---

# source-command-opsx-prt

Use this skill when the user asks to run the migrated source command `opsx-prt`.

## Command Template

按 **Parallel → Review → Test** 顺序执行完整质量保障流程，含门控逻辑。

**Input**: `/opsx:prt [变更名]`。变更名可选；若省略则自动推断或通过 AskUserQuestion 让用户选择。

---

## Steps

### 1. 选择目标变更

如果调用时提供了变更名，直接使用。否则：
- 推断会话上下文中用户提及的变更名
- 若只有一个活跃变更，自动选中并告知用户
- 若有多个活跃变更，运行 `openspec list --json` 后使用 **AskUserQuestion tool** 让用户选择

告知用户："Using change: `<name>`"

---

### 2. 检查任务完成状态

读取 `openspec/changes/<name>/tasks.md`，统计 `- [ ]` 和 `- [x]` 任务数量。

- 若**所有任务已完成**（无 `[ ]`）：跳过 Parallel 阶段，直接进入步骤 4（Review）
- 若有未完成任务：继续执行步骤 3（Parallel）

---

### 3. 阶段 P — 并行实现（Parallel）

使用 **Skill tool** 调用 `openspec-parallel`，传入已选定的变更名。

**检测完成状态：** Parallel 结束后，重新读取 `tasks.md`：
- 若仍有 `- [ ]` 任务 → Parallel 未正常完成（可能因 Merge 冲突暂停）

  输出：
  ```
  ## PRT 流程已停止

  **Change:** <name>
  **阶段:** Parallel（未完成）

  Parallel 阶段结束但仍有未完成任务，可能存在 Merge 冲突或其他阻塞。

  请解决冲突后，重新运行 `/opsx:prt` 或分别运行 `/opsx:review` + `/opsx:test`。
  ```
  停止，不继续 Review 和 Test。

- 若所有任务已完成 → 继续执行步骤 4。

---

### 4. 阶段 R — 代码审查（Review）

使用 **Skill tool** 调用 `openspec-review`，传入变更名。

**检测 ❌ 问题：** Review 结束后，检查输出中是否包含 `❌`：

- **无 ❌**（只有 ✅ 或 ⚠️）：自动继续执行步骤 5（Test），无需用户确认
- **有 ❌**：使用 **AskUserQuestion tool** 询问用户：

  > "Review 发现了 ❌ 级别问题，建议修复后再生成测试。是否继续执行 Test？"

  选项：
  - "继续执行 Test（忽略 ❌ 问题）"
  - "跳过 Test，稍后手动运行"

  若用户选择跳过，输出：
  ```
  ## Test 已跳过

  建议修复上述 ❌ 问题后再运行 `/opsx:test` 或重新运行 `/opsx:prt`。
  ```
  停止。

---

### 5. 阶段 T — 单元测试（Test）

使用 **Skill tool** 调用 `openspec-test`，传入变更名。

---

### 6. 输出完成摘要

全部三个阶段完成后，输出：

```
## PRT 完成

**Change:** <name>
**流程:** Parallel ✓ → Review ✓ → Test ✓

所有阶段完成！可以运行 `/opsx:archive` 归档本次变更。
```

---

## Guardrails

- Parallel 阶段结束后**必须检查** tasks.md 的完成状态，未全部完成则停止
- Review 有 ❌ 时**必须询问**用户，不自动跳过也不自动继续
- Review 只有 ⚠️ 时**直接继续** Test，无需询问
- 三个阶段通过 Skill tool 调用，不复制其内部逻辑
- 任意阶段被用户中断时停止，不继续后续阶段
