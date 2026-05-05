# 敌情分析报告

> **阶段 1：调查研究** | 日期：2026-05-05

---

## 0. 战前评估

| 评估项 | 状态 |
| :--- | :--- |
| 已向用户追问澄清需求 | ✅ |
| 已搜索外部最佳实践 / 前人方案 | ✅ |
| 所有相关代码已阅读 | ✅ |
| 关键代码路径已追踪 | ✅ |
| 至少一种替代方案已考虑 | ✅ |
| 深层需求（隐含约束）已识别 | ✅ |

---

## 1. 任务背景

三个修改：
1. 警长死亡时由 LLM 指定传递对象，而非随机传递
2. 移除"奶穿"机制：守卫守护 + 女巫解救 + 狼刀同一目标时，目标不应死亡
3. 女巫解药用完后不再获知当晚刀口信息

## 1.0 表层需求 → 深层需求

**用户说的是**：警长指定传递、去掉奶穿、女巫解药用后看不见刀口

**实际上需要解决**：
- 警长传递从纯函数 reducer 中移到 session 异步流，由 LLM 决策继任者
- `resolveNight` 中 `doubleProtection` 逻辑删除，简化为正常守卫+解药逻辑
- `buildPlayerContext` 中 witch 的 `currentKillTargetId/Number` 仅在 `!antidoteUsed` 时可见

---

## 2. 认知分析六步法

### 2.1 去粗 — 过滤噪音

| 文件 | 相关性 | 说明 |
| :--- | :--- | :--- |
| `src/domain/reducer.ts:153-222` | **核心** | `resolveNight` — 奶穿逻辑在 159-168 行 |
| `src/domain/reducer.ts:425-434` | **核心** | `transferSheriffIfDead` — 当前随机传递 |
| `src/engine/session.ts:全文件` | **核心** | 需要新增 LLM 警长传递流程 |
| `src/ai/agent.ts:223-266` | **核心** | 需要新增 `decideSheriffTransfer` |
| `src/ai/context.ts:106-110` | **核心** | witch context 条件需改 |
| `src/ai/agent.ts:235-236` | **关联** | witch prompt 使用 context，条件改后自动生效 |

### 2.2 取精 — 核心证据

**问题1 — 随机传递 (reducer.ts:425-434)**：
```typescript
function transferSheriffIfDead(state: FullGameState): FullGameState {
  // ... 
  const successor = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null
  // ...
}
```
纯同步随机选择，不经过 LLM 决策。

**问题2 — 奶穿逻辑 (reducer.ts:159-168)**：
```typescript
const doubleProtection = protectedId !== null && save
  && wolfTarget !== null && wolfTarget === protectedId && save.targetId === protectedId

const deaths = new Set<number>()
if (doubleProtection) {
  deaths.add(wolfTarget!)  // ← 奶穿：同守同救导致死亡
}
```
需删除 `doubleProtection` 判定，简化死亡计算。

**问题3 — 女巫刀口信息泄露 (context.ts:109-110)**：
```typescript
currentKillTargetId: (isWitch || isGameOver) ? currentWolfKillTargetId(state) : null,
currentKillTargetNumber: (isWitch || isGameOver) ? currentWolfKillTargetNumber(state) : null,
```
无论解药是否用掉，女巫都能看到。应改为 `(isWitch && !ability.witchAntidoteUsed) || isGameOver`。

### 2.3 去伪

| 发现 | 类型 | 影响 |
| :--- | :--- | :--- |
| "警长传递有 bug" | 不对 | 是随机传递，不是 bug |
| "奶穿机制需要删除大量代码" | 假象 | 仅需删除 159-168 行 + 简化 death 逻辑 |
| "女巫问题需要改 agent prompt" | 假象 | agent.ts:235 已使用 `context.witch.currentKillTargetNumber`，改 context 即可 |

### 2.4 存真

- `resolveNight` 调用 `transferSheriffIfDead` (line 186)，`resolveVote` (line 277)，`knightDuel` (line 347)，`shootHunter` (line 373) — 四处都需改为调用 session 层的 LLM 传递
- `agent.ts:236` witch prompt 逻辑不变，依赖 context 数据

---

## 3. 主要矛盾分析

**唯一主要矛盾**：三个独立的功能修正共享同一个 resolveNight 路径，改动集中在 reducer.ts + session.ts + context.ts

## 4. 初步方案

### 4.1 奶穿移除 (`reducer.ts`)
删除 `doubleProtection` 变量及相关判断（159-168行），简化死亡计算为：
- 狼刀目标且未被守卫守护 → 死亡
- 女巫解药 → 从死亡集移除目标
- 女巫毒药 → 加入死亡集

### 4.2 女巫刀口信息隐藏 (`context.ts`)
`context.ts:109-110` 条件改为 `(isWitch && !ability.witchAntidoteUsed) || isGameOver`

### 4.3 警长 LLM 传递

**reducer.ts**：
- 导出 `transferSheriffIfDead(state, successorId?: number)`，接受可选继任者参数
- 若 `successorId` 未提供则随机选（作为 LLM 调用失败的兜底）

**agent.ts**：
- 新增 `decideSheriffTransfer(context, config)` → 返回 `number | null`（继任者 ID）
- prompt：警长死亡，选择一个存活玩家传递警徽

**session.ts**：
- 新增 `handleSheriffTransfer(state, config)` — 检测警长是否死亡 → LLM 决策 → 调用 `transferSheriffIfDead`
- 在 `runWolfDiscussion`、`runVote`、`runKnightDuel`、`runHunterShot` 中调用此函数

---

*调查三步走：问用户 → 查外部 → 读代码。禁止主观臆断，每条结论有出处。*
