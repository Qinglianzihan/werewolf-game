<p align="center">
  <img src="public/favicon.svg" width="80" alt="Werewolf Game" />
</p>

<h1 align="center">🐺 狼人杀 · AI 法官</h1>

<p align="center">
  一局 12 人的月下狼人杀——全部由 AI 扮演，你来做上帝。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19.0-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6.3-brightgreen" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8" alt="Tailwind" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## 这是什么

一个完全由 **LLM 大模型驱动的狼人杀游戏**。你不是玩家——你是上帝视角的旁观者。12 个 AI 角色各有性格和策略，会发言、投票、悍跳、甩锅、遗言……每局走向完全不可预测。

- 🎭 **12 人标准局 + 特殊角色**：预女猎守 + 丘比特、白痴、骑士
- 🤖 **全 AI 玩家**：每个 AI 有独立性格（强势带队型、阴阳怪气型、谨慎逻辑型……）
- 👑 **警长竞选**：竞选演讲 → 投票 → 1.5 票归票权 → 死亡传递
- 🌙 **完整夜晚阶段**：狼刀 → 守卫守护 → 女巫解药/毒药 → 预言家查验
- 📜 **遗言系统**：出局玩家发表遗言，可以点狼、给方向、或混淆视听
- 🔍 **上帝视角**：实时查看所有身份、夜间行动、狼群聊天
- 🏰 **中世纪酒馆风格 UI**：暖暗色调，烛光金主题

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 浏览器打开 http://localhost:5173
```

## 配置 AI

游戏支持多个 LLM 后端。在游戏设置中添加你的 API：

| 提供商 | 示例地址 |
| :--- | :--- |
| DeepSeek | `https://api.deepseek.com` |
| OpenAI | `https://api.openai.com` |
| Ollama（本地） | `http://localhost:11434/v1` |

1. 打开游戏 → 点击右上角 **设置**
2. 添加提供商，填入 API 地址和密钥
3. 选择模型，回到大厅点击 **创建对局**

## 玩法

**你不是玩家**。你以上帝视角观看 12 个 AI 完成整局游戏：

| 阶段 | 发生什么 |
| :--- | :--- |
| 🗳️ 警长竞选 | 候选人发表演讲，全员投票选出警长（1.5 票） |
| 🌙 狼人夜聊 | 狼队内部讨论，指定今夜击杀目标 |
| 🛡️ 守卫守护 | 守卫选择一名玩家守护，不可连续守同一人 |
| 🧪 女巫用药 | 女巫可用解药救人或毒药毒人（各一次） |
| 🔮 预言家查验 | 预言家查验一名玩家身份 |
| ☀️ 白天讨论 | 轮流发言，盘逻辑、踩人、表水 |
| 🗡️ 骑士决斗 | 骑士可翻牌决斗一人——狼出局，好人则骑士出局 |
| 🗳️ 放逐投票 | 警长归票，1.5 票权重，平票则无人出局 |
| 💀 遗言 | 出局玩家发表最后发言 |
| 🔫 猎人开枪 | 猎人出局可开枪带走一人 |

## 棋盘配置

| 板子 | 角色配置 |
| :--- | :--- |
| **标准局** | 4狼 + 4民 + 预言家 + 女巫 + 猎人 + 守卫 |
| **白痴局** | 猎人换白痴（被票不死的抗推位） |
| **骑士局** | 猎人换骑士（翻牌决斗，赌心态） |
| **丘比特局** | 白痴换丘比特（恋人链，同生共死） |

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS v4
- **构建**: Vite 6
- **AI**: DeepSeek / OpenAI / Ollama 兼容 API
- **状态管理**: Zustand + 领域驱动设计（纯函数 reducer）

## License

MIT
