import { ROLE_NAMES, Role } from '../domain/types'
import type { ChatMessage, FullGameState, GameEvent, NightAction, Player } from '../domain/types'

export type SpectatorTimelineItem =
  | { id: string; kind: 'event'; content: string }
  | { id: string; kind: 'thought'; content: string; role: Role; tone: 'wolf' | 'seer' | 'witch' | 'guard' }
  | { id: string; kind: 'chat'; message: ChatMessage }

export function buildSpectatorEventLog(state: FullGameState): string[] {
  return state.events.flatMap(event => formatEvent(event, state)).filter(Boolean)
}

export function buildSpectatorTimeline(state: FullGameState): SpectatorTimelineItem[] {
  return state.events.reduce<SpectatorTimelineItem[]>((items, event, index) => {
    if (event.type === 'SpeechSubmitted' && event.channel === 'public') {
      return [...items, { id: `${index}-chat-${event.message.id}`, kind: 'chat', message: event.message }]
    }
    if (event.type === 'NightActionSubmitted') {
      const action = formatNightAction(event.action, state)
      return [...items, { id: `${index}-event-0`, kind: 'event', content: action }]
    }
    if (event.type === 'NightActionSkipped') {
      const actor = state.players.find(p => p.id === event.actorId)
      if (actor?.role === Role.Witch) {
        return [...items, { id: `${index}-event-0`, kind: 'event', content: `夜间跳过：${num(event.actorId)} ${event.reason}` }]
      }
    }
    const events = formatEvent(event, state).map((content, itemIndex) => ({
      id: `${index}-event-${itemIndex}`,
      kind: 'event' as const,
      content,
    }))
    return [...items, ...events]
  }, [])
}

export function buildPlayerThoughts(state: FullGameState): Record<number, string[]> {
  const map: Record<number, string[]> = {}
  state.events.forEach(event => {
    if (event.type === 'NightActionSubmitted') {
      const thought = formatNightThought(event.action, state)
      if (thought) {
        const id = event.action.actorId
        if (!map[id]) map[id] = []
        map[id].push(thought.content)
      }
    }
    if (event.type === 'VoteCast' && event.vote.reason) {
      const id = event.vote.voterId
      if (!map[id]) map[id] = []
      map[id].push(`${num(id)}投票理由：${event.vote.reason}`)
    }
  })
  return map
}

function formatEvent(event: GameEvent, state: FullGameState): string[] {
  if (event.type === 'GameStarted') return [`开局身份：${state.players.map(p => `${p.number}号${ROLE_NAMES[p.role]}`).join(' / ')}`]
  if (event.type === 'NightStarted') return [`第${event.round}夜开始`]
  if (event.type === 'WolfDiscussionStarted') return ['狼人进入夜聊频道']
  if (event.type === 'SpeechSubmitted' && event.channel === 'wolf') return [`狼聊：${num(event.message.playerId)} ${event.message.content}`]
  if (event.type === 'NightActionSubmitted') return [formatNightAction(event.action, state)]
  if (event.type === 'NightActionSkipped') return [`夜间跳过：${num(event.actorId)} ${event.reason}`]
  if (event.type === 'NightResolved') return [`天亮死亡：${event.deaths.length ? event.deaths.map(num).join('、') : '平安夜'}`]
  if (event.type === 'DayStarted') return [`第${event.round}天开始`]
  if (event.type === 'DayDiscussionStarted') return ['公开讨论开始']
  if (event.type === 'VoteStarted') return ['投票开始']
  if (event.type === 'VoteCast') return [`投票：${num(event.vote.voterId)} → ${num(event.vote.targetId)}。理由：${event.vote.reason}`]
  if (event.type === 'VoteSkipped') return [`投票跳过：${num(event.voterId)} ${event.reason}`]
  if (event.type === 'PlayerExiled') return [`放逐结果：${event.playerId ? `${num(event.playerId)} 出局` : '平票无人出局'}`]
  if (event.type === 'SheriffElected') return [`👑 ${num(event.playerId)} 当选警长，拥有 1.5 票归票权`]
  if (event.type === 'SheriffTransferred') return [`👑 警徽传递：${num(event.fromId)} → ${event.toId ? num(event.toId) : '无人继承'}`]
  if (event.type === 'HunterShot') return [`猎人开枪：${num(event.hunterId)} → ${num(event.targetId)}`]
  if (event.type === 'CupidLinked') return [`💘 丘比特连情侣：${num(event.cupidId)}连接 ${event.loverIds.map(num).join(' 和 ')} 成为情侣`]
  if (event.type === 'LoverDied') return [`💔 情侣殉情：${num(event.playerId)}死亡，${num(event.loverId)}殉情而死`]
  if (event.type === 'IdiotRevealed') return [`🤡 白痴翻牌：${num(event.playerId)}暴露白痴身份，失去投票权`]
  if (event.type === 'KnightDuel') return [`⚔ 骑士决斗：${num(event.knightId)}决斗${num(event.targetId)}，${num(event.deadId)}出局`]
  if (event.type === 'LastWordsSubmitted') return [`💬 遗言：${num(event.playerId)}「${event.content.slice(0, 80)}」`]
  if (event.type === 'GameEnded') return [`游戏结束：${event.winner === 'werewolf' ? '狼人阵营' : '好人阵营'}胜利`]
  return []
}

function formatNightAction(action: NightAction, state: FullGameState): string {
  const actor = state.players.find(p => p.id === action.actorId)
  const target = state.players.find(p => p.id === action.targetId)
  if (action.actionType === 'kill') return `狼队最终击杀：${num(action.actorId)}代表狼队 → ${num(action.targetId)}`
  if (action.actionType === 'check') return `预言家查验：${num(action.actorId)}验${num(action.targetId)} = ${target?.role === Role.Werewolf ? '狼人' : '好人'}`
  if (action.actionType === 'save') return `女巫解药：${num(action.actorId)}救${num(action.targetId)}`
  if (action.actionType === 'poison') return `女巫毒药：${num(action.actorId)}毒${num(action.targetId)}`
  if (action.actionType === 'guard') return `守卫守护：${num(action.actorId)}守${num(action.targetId)}`
  return `${roleName(actor)}行动：${num(action.actorId)} → ${num(action.targetId)}`
}

function formatNightThought(action: NightAction, state: FullGameState): Omit<Extract<SpectatorTimelineItem, { kind: 'thought' }>, 'id' | 'kind'> | null {
  const actor = state.players.find(p => p.id === action.actorId)
  if (!actor) return null
  const roleNameMap: Record<string, string> = {
    kill: '狼人',
    check: '预言家',
    save: '女巫',
    poison: '女巫',
    guard: '守卫',
  }
  const roleLabel = roleNameMap[action.actionType] || ROLE_NAMES[actor.role]
  const toneMap: Record<string, SpectatorTimelineItem extends { kind: 'thought'; tone: infer T } ? T : never> = {
    kill: 'wolf' as const,
    check: 'seer' as const,
    save: 'witch' as const,
    poison: 'witch' as const,
    guard: 'guard' as const,
  }
  const tone = toneMap[action.actionType] || 'witch'
  const targetLabel = num(action.targetId)
  if (action.reason) {
    return { role: actor.role, tone, content: `${roleLabel}思考：${num(action.actorId)}决定${actionTypeVerb(action.actionType)}${targetLabel}。理由：${action.reason}` }
  }
  // fallback generic
  const generic: Record<string, string> = {
    kill: `${roleLabel}思考：${num(action.actorId)}代表狼队拍板刀${targetLabel}，把分歧收束成最终刀口。`,
    check: `${roleLabel}思考：${num(action.actorId)}选择查验${targetLabel}，确认对方底牌。`,
    save: `${roleLabel}思考：${num(action.actorId)}决定救${targetLabel}，先保住夜晚刀口。`,
    poison: `${roleLabel}思考：${num(action.actorId)}决定毒${targetLabel}，主动改变夜晚死亡链。`,
    guard: `${roleLabel}思考：${num(action.actorId)}守护${targetLabel}，赌这一晚刀口会落在这里。`,
  }
  return { role: actor.role, tone, content: generic[action.actionType] || `${roleLabel}行动` }
}

function actionTypeVerb(t: string): string {
  if (t === 'kill') return '击杀'
  if (t === 'check') return '查验'
  if (t === 'save') return '救'
  if (t === 'poison') return '毒杀'
  if (t === 'guard') return '守护'
  return '选择'
}

function roleName(player?: Player): string {
  if (!player) return '未知'
  return player.role === Role.Werewolf ? '狼人' : ROLE_NAMES[player.role]
}

function num(id?: number): string {
  return id ? `${id}号` : '未知玩家'
}
