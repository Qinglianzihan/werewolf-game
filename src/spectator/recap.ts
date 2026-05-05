import { ROLE_NAMES } from '../domain/types'
import type { FullGameState } from '../domain/types'

export function buildRecap(state: FullGameState): string[] {
  const winner = state.winner === 'werewolf' ? '狼人阵营' : state.winner === 'villager' ? '好人阵营' : '未结束'
  return [
    `胜利：${winner}`,
    `身份：${state.players.map(p => `${p.number}号${p.name}-${ROLE_NAMES[p.role]}`).join(' / ')}`,
    `死亡链：${state.deaths.map(d => `第${d.round}轮${d.playerIds.map(id => `${id}号`).join('、')}(${d.cause})`).join('；') || '无人死亡'}`,
    `狼聊名场面：${state.wolfChat.at(-1)?.content ?? '暂无'}`,
  ]
}
