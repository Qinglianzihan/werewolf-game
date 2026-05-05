# AI 狼人杀 Implementation Plan

> **For Claude:** 使用 subagent-driven-development 逐任务实施。

**Goal:** 构建界面精美的 AI 狼人杀游戏，支持观战和玩家参与两种模式，多 LLM 厂商接入。

**Architecture:** React + Vite + TypeScript 前端，Zustand 状态管理，纯前端游戏引擎，AI 发言通过 LLM API 生成。暗黑哥特风 UI。

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Zustand

---

### Task 1: 项目骨架搭建

**Files:**
- Write: `src/index.css` ✅ (已完成)
- Write: `src/App.css` ✅ (已完成)
- Write: `src/App.tsx`
- Write: `src/main.tsx`

清理 Vite 模板，挂载 App 根组件（shell）。

---

### Task 2: 游戏引擎 — 角色定义

**Files:**
- Create: `src/game/roles.ts`
- Create: `src/game/types.ts`

定义：
- `Role` 枚举（Werewolf, Villager, Seer, Witch, Hunter, Guard）
- `Player` 接口（id, name, role, isAlive, isAI）
- `GamePhase` 枚举（Lobby, Night, Day, Vote, GameOver）
- `GameConfig` 接口（playerCount, roles, mode）
- 标准 12 人局角色配置

---

### Task 3: 游戏引擎 — 状态机 & 核心逻辑

**Files:**
- Create: `src/game/engine.ts`
- Create: `src/game/actions.ts`
- Create: `src/game/judge.ts`

实现：
- `createGame()` — 初始化游戏，洗牌分配角色
- `processNightActions()` — 处理狼人刀人、预言家查验、女巫用药/毒、守卫守护
- `resolveNight()` — 结算夜晚死亡
- `startVote()` — 进入投票阶段
- `processVote()` — 计票，平票处理
- `checkWinCondition()` — 判定胜负（狼人数量 >= 村民数量 → 狼胜；所有狼死亡 → 好人大胜）

---

### Task 4: AI Provider 系统

**Files:**
- Create: `src/ai/provider.ts`
- Create: `src/ai/types.ts`

实现：
- `ProviderConfig` 接口（name, baseUrl, apiKey, models[]）
- Provider CRUD（add/remove/update）
- `testConnection(provider)` — 发送简单请求测试连通性
- 持久化到 localStorage
- 默认预置 Anthropic、OpenAI 两个厂商

---

### Task 5: AI 提示词模板

**Files:**
- Create: `src/ai/prompts.ts`

实现：
- 每个角色的系统提示词（中文）
- 发言生成提示词（含游戏上下文、角色信息、历史发言）
- 夜间行动决策提示词（狼人选刀、预言家查验、女巫用药等）

---

### Task 6: AI Agent 调用层

**Files:**
- Create: `src/ai/agent.ts`

实现：
- `generateSpeech(player, context)` → 调用 LLM 生成发言
- `decideNightAction(player, context)` → 调用 LLM 决策夜间行动
- 超时处理（15s 超时降级为规则决策）
- 重试逻辑（最多 2 次）

---

### Task 7: Zustand Store

**Files:**
- Create: `src/store/gameStore.ts`
- Create: `src/store/settingsStore.ts`

gameStore:
- `gameConfig`, `players`, `currentPhase`, `round`, `chatHistory`, `nightActions`, `votes`
- Actions: `initGame()`, `nextPhase()`, `addChat()`, `submitVote()`, `resetGame()`

settingsStore:
- `providers: ProviderConfig[]`, `activeProviderId: string`
- Actions: `addProvider()`, `removeProvider()`, `updateProvider()`, `setActiveProvider()`

---

### Task 8: UI — Settings 组件

**Files:**
- Create: `src/components/Settings/Settings.tsx`

实现：
- 厂商列表（卡片式）
- 添加/编辑/删除厂商
- 字段：名称、Base URL、API Key、模型列表（逗号分隔）
- 测试连接按钮（显示 loading/成功/失败状态）
- 设为当前使用的 toggle

---

### Task 9: UI — Lobby 组件

**Files:**
- Create: `src/components/Lobby/Lobby.tsx`

实现：
- 模式选择：观战 / 加入游戏
- 玩家数选择（6/9/12）
- 角色配置预览
- "开始游戏" 按钮
- 暗黑背景 + 标题 glow 效果

---

### Task 10: UI — PlayerCard 组件

**Files:**
- Create: `src/components/PlayerCard/PlayerCard.tsx`

实现：
- 圆形头像 + 角色颜色环
- 存活/死亡状态（死亡灰度+划线）
- 发言气泡（从卡片弹出）
- 投票标记（小旗标）
- 响应式排列

---

### Task 11: UI — NightPhase 组件

**Files:**
- Create: `src/components/NightPhase/NightPhase.tsx`

实现：
- 月亮 & 星星动画背景
- "天黑请闭眼" 过场动画
- 按角色顺序展示夜间行动提示
- 玩家参与模式下：角色专属操作界面（狼人选刀、预言家查验等）
- 观战模式：仅展示行动摘要

---

### Task 12: UI — DayPhase 组件

**Files:**
- Create: `src/components/DayPhase/DayPhase.tsx`

实现：
- 天亮动画
- 死亡公告（昨夜死亡玩家）
- 发言阶段：按顺序发言，发言内容气泡式展示
- 投票阶段：点击玩家卡片投票
- 玩家参与模式：输入框 + 发送按钮
- 观战模式：自动推进

---

### Task 13: UI — Result 组件

**Files:**
- Create: `src/components/Result/Result.tsx`

实现：
- 胜利阵营展示（大标题 + 动画）
- 所有玩家身份揭露
- MVP 标识（可选）
- "再来一局" 按钮

---

### Task 14: UI — Game 主容器

**Files:**
- Create: `src/components/Game/Game.tsx`

实现：
- 根据 `currentPhase` 切换 NightPhase / DayPhase / Result
- 顶部信息栏：回合数、存活数
- 底部玩家环（12 人圆环布局）
- 观战模式：自动播放控制（播放/暂停/加速）

---

### Task 15: App.tsx 组装 + 集成测试

**Files:**
- Edit: `src/App.tsx`

实现：
- 根路由：Lobby → Game → Result
- 整合所有组件
- 端到端流程验证

---

### Task 16: 暗黑主题精修

- 粒子背景（飘浮的烛光粒子）
- 卡片 glassmorphism 效果
- 渐变边框
- 角色专属色系
- 移动端适配
