import type { FullGameState } from '../domain/types'

export function buildHighlights(state: FullGameState): string[] {
  const latestDeath = state.deaths.at(-1)
  const highlights = [
    `当前第 ${state.round} 轮 · ${state.phase}`,
    `存活 ${state.players.filter(p => p.isAlive).length}/${state.players.length}`,
  ]
  if (latestDeath?.playerIds.length) highlights.push(`最近死亡：${latestDeath.playerIds.map(id => `${id}号`).join('、')}`)
  if (state.votes.length) highlights.push(`实时票数：${state.votes.length} 票已投`)
  if (state.wolfChat.length) highlights.push(`狼队已产生 ${state.wolfChat.length} 条夜聊`)
  return highlights
}
