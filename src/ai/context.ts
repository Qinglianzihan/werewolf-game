import { Role } from '../domain/types'
import type { Alignment, FullGameState, GameEvent, NightAction, Player, Role as RoleType, Vote } from '../domain/types'

export interface VisiblePlayer {
  id: number
  number: number
  name: string
  isAlive: boolean
  role?: RoleType
}

export interface SpeakingOrder {
  position: number          // 1-based: 你是第几个发言
  alreadySpoken: { number: number; name: string; summary?: string }[]  // 已经发过言的
  notYetSpoken: number[]    // 还没轮到的人（号码），不要评价他们"沉默"
}

export interface PlayerContext {
  self: Player
  round: number
  phase: FullGameState['phase']
  players: VisiblePlayer[]
  speakingOrder: SpeakingOrder | null  // 白天发言时非null，夜晚为null
  publicChat: FullGameState['publicChat']
  publicVotes: PublicVote[]
  ownActions: FullGameState['nightActions']
  deaths: FullGameState['deaths']
  wolfPartners: Player[]
  wolfChat: FullGameState['wolfChat']
  seerChecks: { targetId: number; alignment: Alignment; round: number }[]
  witch: {
    antidoteUsed: boolean
    poisonUsed: boolean
    currentKillTargetId: number | null
    currentKillTargetNumber: number | null
  }
  guardHistory: number[]
  memory: FullGameState['memories'][number]
  winner: FullGameState['winner']
  history: PlayerContextHistory
}

export interface PlayerContextHistory {
  events: PlayerVisibleEvent[]
  publicChat: FullGameState['publicChat']
  wolfChat: FullGameState['wolfChat']
  voteHistory: PublicVote[]
  nightActionHistory: NightAction[]
  ownActionHistory: NightAction[]
  deathHistory: FullGameState['deaths']
}

export type PlayerVisibleEvent =
  | Exclude<GameEvent, { type: 'GameStarted' }>
  | { type: 'GameStarted'; round: number; players: VisiblePlayer[] }

export type PublicVote = Pick<Vote, 'voterId' | 'targetId'>

export interface GodView {
  players: VisiblePlayer[]
  publicChat: FullGameState['publicChat']
  wolfChat: FullGameState['wolfChat']
  events: FullGameState['events']
  nightActions: FullGameState['nightActions']
  votes: FullGameState['votes']
  seerChecks: FullGameState['seerChecks']
  abilities: FullGameState['abilities']
  deaths: FullGameState['deaths']
  winner: FullGameState['winner']
}

export function buildPlayerContext(playerId: number, state: FullGameState): PlayerContext {
  const self = state.players.find(p => p.id === playerId)
  if (!self) throw new Error(`未知玩家：${playerId}`)
  const isWolf = self.role === Role.Werewolf
  const isSeer = self.role === Role.Seer
  const isWitch = self.role === Role.Witch
  const isGuard = self.role === Role.Guard
  const isGameOver = !!state.winner
  const ability = state.abilities[self.id]
  const nightActionHistory = isGameOver ? allNightActions(state) : visibleNightActions(self, state)
  const history: PlayerContextHistory = {
    events: isGameOver ? allVisibleEvents(state) : visibleEvents(self, state),
    publicChat: state.publicChat,
    wolfChat: (isWolf || isGameOver) ? state.wolfChat : [],
    voteHistory: publicVotesFromEvents(state),
    nightActionHistory,
    ownActionHistory: nightActionHistory.filter(a => a.actorId === self.id),
    deathHistory: state.deaths,
  }
  const knownWolfIds = knownRolePlayerIds(self, state)
  const speakingOrder = buildSpeakingOrder(self, state)
  return {
    self,
    round: state.round,
    phase: state.phase,
    players: visiblePlayersFor(self, state, knownWolfIds),
    speakingOrder,
    publicChat: state.publicChat,
    publicVotes: publicVotes(state),
    ownActions: state.nightActions.filter(a => a.actorId === self.id),
    deaths: state.deaths,
    wolfPartners: (isWolf || isGameOver) ? state.players.filter(p => p.role === Role.Werewolf && p.id !== self.id) : [],
    wolfChat: (isWolf || isGameOver) ? state.wolfChat : [],
    seerChecks: isGameOver ? allSeerChecks(state) : (isSeer ? state.seerChecks[self.id] ?? [] : []),
    witch: {
      antidoteUsed: (isWitch || isGameOver) ? ability.witchAntidoteUsed : false,
      poisonUsed: (isWitch || isGameOver) ? ability.witchPoisonUsed : false,
      currentKillTargetId: ((isWitch && !ability.witchAntidoteUsed) || isGameOver) ? currentWolfKillTargetId(state) : null,
      currentKillTargetNumber: ((isWitch && !ability.witchAntidoteUsed) || isGameOver) ? currentWolfKillTargetNumber(state) : null,
    },
    guardHistory: (isGuard || isGameOver) && ability.guardLastTargetId ? [ability.guardLastTargetId] : [],
    memory: state.memories[self.id],
    winner: state.winner,
    history,
  }
}

function publicVotes(state: FullGameState): PublicVote[] {
  return state.votes.map(vote => ({ voterId: vote.voterId, targetId: vote.targetId }))
}

function publicVotesFromEvents(state: FullGameState): PublicVote[] {
  return state.events.flatMap(e => e.type === 'VoteCast' ? [{ voterId: e.vote.voterId, targetId: e.vote.targetId }] : [])
}

function currentWolfKillTargetId(state: FullGameState): number | null {
  const kills = state.nightActions.filter(a => a.actionType === 'kill')
  const counts = new Map<number, number>()
  kills.forEach(action => counts.set(action.targetId, (counts.get(action.targetId) ?? 0) + 1))
  let target: number | null = null
  let max = 0
  let tied = false
  counts.forEach((count, id) => {
    if (count > max) {
      target = id
      max = count
      tied = false
    } else if (count === max) {
      tied = true
    }
  })
  return tied ? null : target
}

function currentWolfKillTargetNumber(state: FullGameState): number | null {
  const id = currentWolfKillTargetId(state)
  return id ? state.players.find(p => p.id === id)?.number ?? null : null
}

function knownRolePlayerIds(self: Player, state: FullGameState): Set<number> {
  if (state.winner) return new Set(state.players.map(p => p.id))
  return new Set(self.role === Role.Werewolf ? state.players.filter(p => p.role === Role.Werewolf).map(p => p.id) : [self.id])
}

function visiblePlayersFor(self: Player, state: FullGameState, knownIds = knownRolePlayerIds(self, state)): VisiblePlayer[] {
  return state.players.map(p => ({
    id: p.id,
    number: p.number,
    name: p.name,
    isAlive: p.isAlive,
    role: knownIds.has(p.id) ? p.role : undefined,
  }))
}

function visibleNightActions(self: Player, state: FullGameState): NightAction[] {
  const actions = state.events.flatMap(e => e.type === 'NightActionSubmitted' ? [e.action] : [])
  if (self.role === Role.Werewolf) {
    const wolfIds = new Set(state.players.filter(p => p.role === Role.Werewolf).map(p => p.id))
    return actions.filter(a => wolfIds.has(a.actorId))
  }
  return actions.filter(a => a.actorId === self.id)
}

function buildSpeakingOrder(self: Player, state: FullGameState): SpeakingOrder | null {
  if (state.phase !== 'dayDiscussion' && state.phase !== 'sheriffElection' && state.phase !== 'freeDiscussion') return null
  const alive = alivePlayersList(state)

  // Free discussion: only count freeDiscussion messages, not dayDiscussion messages
  const isFree = state.phase === 'freeDiscussion'
  const spokenThisRound = state.publicChat
    .filter(m => m.round === state.round && m.playerId && (!isFree || m.phase === 'freeDiscussion'))
    .map(m => m.playerId!)

  const alreadySpoken = alive
    .filter(p => spokenThisRound.includes(p.id) && p.id !== self.id)
    .map(p => ({ number: p.number, name: p.name }))
  const notYetSpoken = alive
    .filter(p => !spokenThisRound.includes(p.id) && p.id !== self.id)
    .map(p => p.number)
  const position = alreadySpoken.length + 1
  return { position, alreadySpoken, notYetSpoken }
}

function alivePlayersList(state: FullGameState): Player[] {
  return state.players.filter(p => p.isAlive)
}

function visibleEvents(self: Player, state: FullGameState): PlayerVisibleEvent[] {
  return state.events.reduce<PlayerVisibleEvent[]>((events, event) => {
    if (event.type === 'GameStarted') return [...events, { ...event, players: visiblePlayersFor(self, state) }]
    if (event.type === 'VoteCast') {
      return [...events, { ...event, vote: { voterId: event.vote.voterId, targetId: event.vote.targetId, reason: event.vote.voterId === self.id ? event.vote.reason : '' } }]
    }
    if (event.type === 'CupidLinked') {
      if (self.id !== event.cupidId && !event.loverIds.includes(self.id)) return events
      return [...events, self.id === event.cupidId ? event : { type: 'CupidLinked', round: event.round, cupidId: 0, loverIds: event.loverIds }]
    }
    if (event.type !== 'NightActionSubmitted') {
      return event.type !== 'SpeechSubmitted' || event.channel !== 'wolf' || self.role === Role.Werewolf ? [...events, event] : events
    }
    if (self.role === Role.Werewolf) {
      const actor = state.players.find(p => p.id === event.action.actorId)
      return actor?.role === Role.Werewolf ? [...events, event] : events
    }
    return event.action.actorId === self.id ? [...events, event] : events
  }, [])
}

function allNightActions(state: FullGameState): NightAction[] {
  return state.events.flatMap(e => e.type === 'NightActionSubmitted' ? [e.action] : [])
}

function allVisibleEvents(state: FullGameState): PlayerVisibleEvent[] {
  const allPlayers = state.players.map(p => ({
    id: p.id, number: p.number, name: p.name, isAlive: p.isAlive, role: p.role,
  }))
  return state.events.map(event => {
    if (event.type === 'GameStarted') return { ...event, players: allPlayers }
    return event as PlayerVisibleEvent
  })
}

function allSeerChecks(state: FullGameState): { targetId: number; alignment: Alignment; round: number }[] {
  return Object.values(state.seerChecks).flat()
}

export function buildGodView(state: FullGameState): GodView {
  return {
    players: state.players.map(p => ({
      id: p.id,
      number: p.number,
      name: p.name,
      isAlive: p.isAlive,
      role: p.role,
    })),
    publicChat: state.publicChat,
    wolfChat: state.wolfChat,
    events: state.events,
    nightActions: state.nightActions,
    votes: state.votes,
    seerChecks: state.seerChecks,
    abilities: state.abilities,
    deaths: state.deaths,
    winner: state.winner,
  }
}
