import { Phase, Role } from './types'
import type {
  AbilityState,
  ChatMessage,
  FullGameState,
  GameConfig,
  NightAction,
  Player,
  Vote,
} from './types'
import { getRoles } from './rulesets'
import { alivePlayers, checkWinCondition, playerById } from './selectors'

const NAMES = ['墨渊', '青丘', '白芷', '玄夜', '素衣', '寒江', '孤月', '霜华', '影刃', '夜莺', '冷锋', '暗香']
const PERSONALITIES = ['强势带队型', '阴阳怪气型', '谨慎逻辑型', '情绪煽动型', '沉默观察型', '反问压迫型']

export function createInitialState(config: GameConfig): FullGameState {
  const roles = config.roles ? [...config.roles] : shuffle(getRoles(config))
  const players: Player[] = roles.map((role, index) => ({
    id: index + 1,
    number: index + 1,
    name: NAMES[index % NAMES.length],
    role,
    isAlive: true,
    isAI: true,
    personality: PERSONALITIES[index % PERSONALITIES.length],
  }))
  const abilities = Object.fromEntries(players.map(p => [p.id, emptyAbility()]))
  const memories = Object.fromEntries(players.map(p => [p.id, {
    personality: p.personality,
    memory: [],
    suspicionMap: Object.fromEntries(players.filter(x => x.id !== p.id).map(x => [x.id, 0.3])),
    alliances: [],
    strategyNotes: [],
  }]))
  const state: FullGameState = {
    config: { playerCount: config.playerCount, roles, board: config.board ?? 'standard' },
    players,
    phase: Phase.WolfDiscussion,
    round: 1,
    events: [],
    publicChat: [],
    wolfChat: [],
    nightActions: [],
    votes: [],
    deaths: [],
    seerChecks: {},
    abilities,
    memories,
    lovers: [],
    sheriffId: null,
    lastWords: {},
    winner: null,
    isPaused: false,
    aiStatus: '待开始',
  }
  return {
    ...state,
    events: [
      { type: 'GameStarted', round: 1, players },
      { type: 'NightStarted', round: 1 },
      { type: 'WolfDiscussionStarted', round: 1 },
    ],
  }
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function emptyAbility(): AbilityState {
  return {
    witchAntidoteUsed: false,
    witchPoisonUsed: false,
    guardLastTargetId: null,
    hunterShotUsed: false,
    cupidLinked: false,
    idiotRevealed: false,
    knightDuelUsed: false,
    canVote: true,
  }
}

export function addChat(state: FullGameState, input: Omit<ChatMessage, 'id' | 'round' | 'phase'>): FullGameState {
  const message: ChatMessage = {
    ...input,
    id: `${Date.now()}-${state.events.length}`,
    round: state.round,
    phase: state.phase,
  }
  if (message.channel === 'wolf') {
    return {
      ...state,
      wolfChat: [...state.wolfChat, message],
      events: [...state.events, { type: 'SpeechSubmitted', channel: message.channel, message }],
    }
  }
  if (message.channel === 'system') {
    return {
      ...state,
      events: [...state.events, { type: 'SpeechSubmitted', channel: message.channel, message }],
    }
  }
  return {
    ...state,
    publicChat: [...state.publicChat, message],
    events: [...state.events, { type: 'SpeechSubmitted', channel: message.channel, message }],
  }
}

export function submitNightAction(state: FullGameState, action: NightAction): FullGameState {
  const actor = playerById(state, action.actorId)
  const target = playerById(state, action.targetId)
  if (!actor.isAlive) throw new Error('死亡玩家不能夜间行动')
  if (!target.isAlive) throw new Error('不能选择死亡目标')
  if (!isRoleAction(actor.role, action.actionType)) throw new Error('角色不能执行该行动')
  const ability = state.abilities[actor.id]
  if (action.actionType === 'poison' && ability.witchPoisonUsed) throw new Error('毒药已经用完')
  if (action.actionType === 'save' && ability.witchAntidoteUsed) throw new Error('解药已经用完')
  if (action.actionType === 'guard' && ability.guardLastTargetId === action.targetId) throw new Error('守卫不能连续守同一人')

  const seerChecks = action.actionType === 'check'
    ? {
        ...state.seerChecks,
        [actor.id]: [
          ...(state.seerChecks[actor.id] ?? []),
          { targetId: target.id, alignment: target.role === Role.Werewolf ? 'werewolf' as const : 'good' as const, round: state.round },
        ],
      }
    : state.seerChecks
  return {
    ...state,
    seerChecks,
    nightActions: [...state.nightActions, action],
    events: [...state.events, { type: 'NightActionSubmitted', round: state.round, action }],
  }
}

function isRoleAction(role: Role, action: NightAction['actionType']): boolean {
  return (
    (role === Role.Werewolf && action === 'kill') ||
    (role === Role.Seer && action === 'check') ||
    (role === Role.Witch && (action === 'save' || action === 'poison')) ||
    (role === Role.Guard && action === 'guard')
  )
}

export function resolveNight(state: FullGameState): FullGameState {
  const protectedId = state.nightActions.find(a => a.actionType === 'guard')?.targetId ?? null
  const wolfTarget = pickConsensusTarget(state.nightActions.filter(a => a.actionType === 'kill'))
  const save = state.nightActions.find(a => a.actionType === 'save')
  const poison = state.nightActions.find(a => a.actionType === 'poison')

  const deaths = new Set<number>()
  if (wolfTarget !== null && wolfTarget !== protectedId) {
    deaths.add(wolfTarget)
  }

  if (save) deaths.delete(save.targetId)
  if (poison) deaths.add(poison.targetId)

  const updatedAbilities = { ...state.abilities }
  state.nightActions.forEach(action => {
    const current = updatedAbilities[action.actorId]
    updatedAbilities[action.actorId] = {
      ...current,
      witchAntidoteUsed: current.witchAntidoteUsed || action.actionType === 'save',
      witchPoisonUsed: current.witchPoisonUsed || action.actionType === 'poison',
      guardLastTargetId: action.actionType === 'guard' ? action.targetId : current.guardLastTargetId,
    }
  })

  const deathIds = expandLoverDeaths(state, [...deaths])
  const hunterId = hunterShouldShoot(state, deathIds)
  let nextState: FullGameState = {
    ...state,
    players: state.players.map(p => deathIds.includes(p.id) ? { ...p, isAlive: false } : p),
    abilities: updatedAbilities,
    deaths: deathIds.length ? [...state.deaths, { round: state.round, playerIds: deathIds, cause: 'night' }] : state.deaths,
    nightActions: [],
    phase: hunterId ? Phase.HunterShot : Phase.DayDiscussion,
    aiStatus: hunterId ? '猎人开枪' : '白天讨论',
    events: [
      ...state.events,
      ...loverEvents(state, [...deaths], deathIds),
      { type: 'NightResolved', round: state.round, deaths: deathIds },
      ...(hunterId ? [] : [{ type: 'DayStarted' as const, round: state.round, deaths: deathIds }, { type: 'DayDiscussionStarted' as const, round: state.round }]),
    ],
  }
  nextState = endIfWon(nextState)
  return nextState
}

function pickConsensusTarget(actions: NightAction[]): number | null {
  const counts = new Map<number, number>()
  actions.forEach(a => counts.set(a.targetId, (counts.get(a.targetId) ?? 0) + 1))
  let target: number | null = null
  let max = 0
  let tie = false
  counts.forEach((count, id) => {
    if (count > max) {
      target = id
      max = count
      tie = false
    } else if (count === max) {
      tie = true
    }
  })
  return tie ? null : target
}

export function castVote(state: FullGameState, vote: Vote): FullGameState {
  const voter = playerById(state, vote.voterId)
  const target = playerById(state, vote.targetId)
  if (!voter.isAlive) throw new Error('死亡玩家不能投票')
  if (!state.abilities[voter.id]?.canVote) throw new Error('该玩家已经没有投票权')
  if (!target.isAlive) throw new Error('不能投给死亡玩家')
  if (voter.id === target.id) throw new Error('不能投给自己')
  return {
    ...state,
    votes: [...state.votes.filter(v => v.voterId !== vote.voterId), vote],
    events: [...state.events, { type: 'VoteCast', round: state.round, vote }],
  }
}

export function skipNightAction(state: FullGameState, actorId: number, reason: string): FullGameState {
  return {
    ...state,
    events: [...state.events, { type: 'NightActionSkipped', round: state.round, actorId, reason }],
  }
}

export function skipVote(state: FullGameState, voterId: number, reason: string): FullGameState {
  return {
    ...state,
    events: [...state.events, { type: 'VoteSkipped', round: state.round, voterId, reason }],
  }
}

export function resolveVote(state: FullGameState): FullGameState {
  const targetId = pickConsensusVote(state)
  const target = targetId ? playerById(state, targetId) : null
  if (target?.role === Role.Idiot && !state.abilities[target.id].idiotRevealed) {
    const abilities = {
      ...state.abilities,
      [target.id]: { ...state.abilities[target.id], idiotRevealed: true, canVote: false },
    }
    return {
      ...state,
      abilities,
      votes: [],
      phase: Phase.WolfDiscussion,
      round: state.round + 1,
      events: [
        ...state.events,
        { type: 'PlayerExiled', round: state.round, playerId: targetId },
        { type: 'IdiotRevealed', round: state.round, playerId: target.id },
        { type: 'NightStarted', round: state.round + 1 },
        { type: 'WolfDiscussionStarted', round: state.round + 1 },
      ],
    }
  }
  const deathIds = targetId ? expandLoverDeaths(state, [targetId]) : []
  const deaths = deathIds.length ? [{ round: state.round, playerIds: deathIds, cause: 'vote' as const }] : []
  const hunterId = hunterShouldShoot(state, deathIds)
  let nextState: FullGameState = {
    ...state,
    players: state.players.map(p => deathIds.includes(p.id) ? { ...p, isAlive: false } : p),
    deaths: deaths.length ? [...state.deaths, ...deaths] : state.deaths,
    votes: [],
    phase: hunterId ? Phase.HunterShot : Phase.WolfDiscussion,
    round: hunterId ? state.round : state.round + 1,
    aiStatus: hunterId ? '猎人开枪' : '狼人夜聊',
    events: [
      ...state.events,
      ...loverEvents(state, targetId ? [targetId] : [], deathIds),
      { type: 'PlayerExiled', round: state.round, playerId: targetId },
      ...(hunterId ? [] : [{ type: 'NightStarted' as const, round: state.round + 1 }, { type: 'WolfDiscussionStarted' as const, round: state.round + 1 }]),
    ],
  }
  nextState = endIfWon(nextState)
  return nextState
}

function pickConsensusVote(state: FullGameState): number | null {
  const aliveIds = new Set(alivePlayers(state).map(p => p.id))
  const counts = new Map<number, number>()
  state.votes.forEach(v => {
    if (aliveIds.has(v.voterId) && aliveIds.has(v.targetId) && state.abilities[v.voterId]?.canVote !== false) {
      counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + (v.voterId === state.sheriffId ? 1.5 : 1))
    }
  })
  let target: number | null = null
  let max = 0
  let tie = false
  counts.forEach((count, id) => {
    if (count > max) {
      target = id
      max = count
      tie = false
    } else if (count === max) {
      tie = true
    }
  })
  return tie ? null : target
}

export function linkCupidLovers(state: FullGameState, cupidId: number, loverIds: [number, number] | number[]): FullGameState {
  const cupid = playerById(state, cupidId)
  if (cupid.role !== Role.Cupid) throw new Error('只有丘比特可以指定情侣')
  if (state.abilities[cupidId].cupidLinked) throw new Error('丘比特已经指定过情侣')
  if (loverIds.length !== 2 || loverIds[0] === loverIds[1]) throw new Error('必须指定两名不同情侣')
  loverIds.forEach(id => {
    const player = playerById(state, id)
    if (!player.isAlive) throw new Error('不能指定死亡玩家为情侣')
  })
  return {
    ...state,
    lovers: [...loverIds],
    abilities: {
      ...state.abilities,
      [cupidId]: { ...state.abilities[cupidId], cupidLinked: true },
    },
    events: [...state.events, { type: 'CupidLinked', round: state.round, cupidId, loverIds: [...loverIds] }],
  }
}

export function knightDuel(state: FullGameState, knightId: number, targetId: number): FullGameState {
  const knight = playerById(state, knightId)
  const target = playerById(state, targetId)
  if (knight.role !== Role.Knight) throw new Error('只有骑士可以决斗')
  if (state.abilities[knightId].knightDuelUsed) throw new Error('骑士已经决斗过')
  if (!knight.isAlive || !target.isAlive) throw new Error('决斗双方必须存活')
  const deadId = target.role === Role.Werewolf ? targetId : knightId
  const deathIds = expandLoverDeaths(state, [deadId])
  const nextState: FullGameState = {
    ...state,
    players: state.players.map(p => deathIds.includes(p.id) ? { ...p, isAlive: false } : p),
    abilities: {
      ...state.abilities,
      [knightId]: { ...state.abilities[knightId], knightDuelUsed: true },
    },
    deaths: [...state.deaths, { round: state.round, playerIds: deathIds, cause: 'vote' }],
    events: [
      ...state.events,
      { type: 'KnightDuel', round: state.round, knightId, targetId, deadId },
      ...loverEvents(state, [deadId], deathIds),
    ],
  }
  return endIfWon(nextState)
}


export function shootHunter(state: FullGameState, hunterId: number, targetId: number): FullGameState {
  const hunter = playerById(state, hunterId)
  const target = playerById(state, targetId)
  if (hunter.role !== Role.Hunter) throw new Error('Only hunter can shoot')
  if (hunter.isAlive) throw new Error('Hunter must be dead before shooting')
  if (state.abilities[hunterId].hunterShotUsed) throw new Error('Hunter already shot')
  if (!target.isAlive) throw new Error('Cannot shoot dead player')
  const deathIds = expandLoverDeaths(state, [targetId])
  const nextState = {
    ...state,
    players: state.players.map(p => deathIds.includes(p.id) ? { ...p, isAlive: false } : p),
    abilities: {
      ...state.abilities,
      [hunterId]: { ...state.abilities[hunterId], hunterShotUsed: true },
    },
    deaths: [...state.deaths, { round: state.round, playerIds: deathIds, cause: 'hunter' }],
    events: [
      ...state.events,
      { type: 'HunterShot', round: state.round, hunterId, targetId },
      ...loverEvents(state, [targetId], deathIds),
    ],
  }
  return endIfWon(nextState)
}

export function submitLastWords(state: FullGameState, playerId: number, content: string): FullGameState {
  const player = playerById(state, playerId)
  if (player.isAlive) throw new Error('只有出局玩家可以发表遗言')
  if (state.lastWords[playerId]) return state
  const next = {
    ...state,
    lastWords: { ...state.lastWords, [playerId]: content },
  }
  return addChat(next, { channel: 'public', playerId, content, tags: ['遗言'] })
}

function expandLoverDeaths(state: FullGameState, initialDeaths: number[]): number[] {
  const deaths = new Set(initialDeaths)
  const [a, b] = state.lovers
  if (a && b) {
    if (deaths.has(a)) deaths.add(b)
    if (deaths.has(b)) deaths.add(a)
  }
  return [...deaths]
}

function loverEvents(state: FullGameState, initialDeaths: number[], finalDeaths: number[]): FullGameState['events'] {
  const [a, b] = state.lovers
  if (!a || !b) return []
  const events: FullGameState['events'] = []
  if (initialDeaths.includes(a) && finalDeaths.includes(b) && !initialDeaths.includes(b)) {
    events.push({ type: 'LoverDied', round: state.round, playerId: a, loverId: b })
  }
  if (initialDeaths.includes(b) && finalDeaths.includes(a) && !initialDeaths.includes(a)) {
    events.push({ type: 'LoverDied', round: state.round, playerId: b, loverId: a })
  }
  return events
}


export function transferSheriffIfDead(state: FullGameState, successorId?: number): FullGameState {
  if (!state.sheriffId) return state
  const sheriff = state.players.find(p => p.id === state.sheriffId)
  if (sheriff?.isAlive) return state
  const candidates = alivePlayers(state).filter(p => p.id !== state.sheriffId)
  const successor = successorId !== undefined
    ? candidates.find(c => c.id === successorId) ?? null
    : candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null
  return {
    ...state,
    sheriffId: successor?.id ?? null,
    events: [...state.events, { type: 'SheriffTransferred', round: state.round, fromId: sheriff?.id ?? state.sheriffId, toId: successor?.id ?? null }],
  }
}

export function startVote(state: FullGameState): FullGameState {
  return { ...state, phase: Phase.Vote, events: [...state.events, { type: 'VoteStarted', round: state.round }] }
}

function endIfWon(state: FullGameState): FullGameState {
  const winner = checkWinCondition(state)
  if (!winner) return state
  return {
    ...state,
    winner,
    phase: Phase.PostGameDiscussion,
    aiStatus: '赛后自由讨论',
    events: [...state.events, { type: 'GameEnded', round: state.round, winner }],
  }
}

function hunterShouldShoot(state: FullGameState, deathIds: number[]): number | null {
  const alive = alivePlayers(state).filter(p => !deathIds.includes(p.id))
  if (!alive.length) return null
  return deathIds.find(id => {
    const p = state.players.find(x => x.id === id)
    return p?.role === Role.Hunter && !state.abilities[id]?.hunterShotUsed
  }) ?? null
}
