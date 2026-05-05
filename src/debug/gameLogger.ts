import { ROLE_NAMES } from '../domain/types'
import type { FullGameState } from '../domain/types'
import type { AIConfig } from '../ai/types'
import type { PlayerContext } from '../ai/context'
import { buildSpectatorEventLog } from '../spectator/eventLog'

const SESSION_KEY = 'werewolf-current-log-session'
const MAX_API_LOGS = 300

export interface ApiLogEntry {
  id: string
  gameId: string
  at: string
  task: string
  player?: string
  role?: string
  provider: string
  model: string
  url?: string
  status: 'start' | 'success' | 'error' | 'fallback'
  durationMs?: number
  request?: unknown
  response?: unknown
  error?: string
}

export interface LogSession {
  gameId: string
  startedAt: string
  apiLogs: ApiLogEntry[]
}

export function startLogSession(): string {
  const gameId = `game-${new Date().toISOString().replace(/[:.]/g, '-')}`
  writeSession({ gameId, startedAt: new Date().toISOString(), apiLogs: [] })
  return gameId
}

export function readLogSession(): LogSession {
  if (typeof localStorage === 'undefined') return emptySession()
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw) as LogSession
  } catch { /* ignore */ }
  const session = emptySession()
  writeSession(session)
  return session
}

export function appendApiLog(entry: Omit<ApiLogEntry, 'id' | 'gameId' | 'at'>): void {
  const session = readLogSession()
  const next: LogSession = {
    ...session,
    apiLogs: [
      ...session.apiLogs,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        gameId: session.gameId,
        at: new Date().toISOString(),
        ...entry,
      },
    ].slice(-MAX_API_LOGS),
  }
  writeSession(next)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('werewolf-logs-updated'))
}

export function buildReplayText(state: FullGameState): string {
  const lines = [
    `# AI 狼人杀对局回放`,
    `生成时间：${new Date().toLocaleString()}`,
    `轮次/阶段：第${state.round}轮 ${state.phase}`,
    `胜者：${state.winner ?? '未结束'}`,
    '',
    `## 身份`,
    state.players.map(p => `${p.number}号 ${p.name} ${ROLE_NAMES[p.role]} ${p.isAlive ? '存活' : '出局'} · ${p.personality}`).join('\n'),
    '',
    `## 事件流`,
    buildSpectatorEventLog(state).map((line, i) => `${i + 1}. ${line}`).join('\n'),
    '',
    `## 狼聊`,
    state.wolfChat.map(m => `第${m.round}轮 ${m.playerId ?? '?'}号：${m.content}`).join('\n') || '无',
    '',
    `## 公开发言`,
    state.publicChat.map(m => `第${m.round}轮 ${m.playerId ?? '系统'}号：${m.content}`).join('\n') || '无',
    '',
    `## 原始事件 JSON`,
    JSON.stringify(state.events, null, 2),
  ]
  return lines.join('\n')
}

export function buildApiLogText(): string {
  return JSON.stringify(readLogSession(), null, 2)
}

export function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function redactRequest(request: Record<string, unknown>): Record<string, unknown> {
  return request
}

export function playerLabel(context?: PlayerContext): string | undefined {
  return context ? `${context.self.number}号 ${context.self.name}` : undefined
}

export function providerLabel(config: AIConfig): { provider: string; model: string; url?: string } {
  const provider = config.providers.find(p => p.id === config.activeProviderId)
  const remembered = provider ? config.activeModelsByProvider?.[provider.id] : undefined
  const model = provider && remembered && provider.models.includes(remembered)
    ? remembered
    : provider && config.activeModel && provider.models.includes(config.activeModel)
      ? config.activeModel
      : provider?.models[0] || config.activeModel || 'none'
  return {
    provider: provider?.name ?? (config.activeProviderId || 'none'),
    model,
    url: provider ? `${provider.baseUrl}/chat/completions` : undefined,
  }
}


function emptySession(): LogSession {
  return { gameId: 'no-game', startedAt: new Date().toISOString(), apiLogs: [] }
}

function writeSession(session: LogSession): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}
