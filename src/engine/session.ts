import { Phase, Role } from '../domain/types'
import type { FullGameState } from '../domain/types'
import type { AIConfig } from '../ai/types'
import { buildPlayerContext } from '../ai/context'
import { decideCupidLink, decideDaySpeech, decideFreeDiscussionSpeech, decideKnightDuel, decideLastWords, decideNightAction, decidePostGameSpeech, decideSheriffSpeech, decideSheriffTransfer, decideSheriffVote, decideVote, decideWolfDiscussionSpeech } from '../ai/agent'
import {
  addChat,
  castVote,
  knightDuel,
  linkCupidLovers,
  resolveNight,
  resolveVote,
  shootHunter,
  skipNightAction,
  skipVote,
  startVote,
  submitLastWords,
  submitNightAction,
  transferSheriffIfDead,
} from '../domain/reducer'
import { alivePlayers } from '../domain/selectors'

async function handleSheriffTransfer(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  if (!state.sheriffId) return state
  const sheriff = state.players.find(p => p.id === state.sheriffId)
  if (sheriff?.isAlive) return state
  const candidates = alivePlayers(state).filter(p => p.id !== state.sheriffId)
  if (!candidates.length) return transferSheriffIfDead(state)
  try {
    const context = buildPlayerContext(state.sheriffId, state)
    const successorId = await decideSheriffTransfer(context, config)
    const validSuccessor = state.players.find(p => p.id === successorId && p.isAlive && p.id !== state.sheriffId)
    return transferSheriffIfDead(state, validSuccessor?.id ?? candidates[Math.floor(Math.random() * candidates.length)].id)
  } catch {
    return transferSheriffIfDead(state)
  }
}

export async function runSessionStep(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  if (state.isPaused) return state
  const withLastWords = await submitPendingLastWords(state, config)
  if (withLastWords !== state) return withLastWords
  if (state.phase === Phase.PostGameDiscussion) return runPostGameDiscussion(state, config)
  if (state.phase === Phase.HunterShot) return runHunterShot(state, config)
  if (state.phase === Phase.KnightDuel) return runKnightDuel(state, config)
  if (state.phase === Phase.SheriffElection) return runSheriffElection(state, config)
  if (state.winner) return state
  if (state.phase === Phase.WolfDiscussion) return runWolfDiscussion(state, config)
  if (state.phase === Phase.DayDiscussion) {
    if (state.config.playerCount === 12 && state.round === 1 && state.sheriffId === null) {
      return runSheriffElection({ ...state, phase: Phase.SheriffElection, aiStatus: '警长竞选' }, config)
    }
    return runDayDiscussion(state, config)
  }
  if (state.phase === Phase.FreeDiscussion) return runFreeDiscussion(state, config)
  if (state.phase === Phase.Vote) return runVote(state, config)
  return state
}

async function runHunterShot(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  const deathRecord = state.deaths.at(-1)
  const hunterId = deathRecord?.playerIds.find(id => {
    const p = state.players.find(x => x.id === id)
    return p?.role === Role.Hunter && !state.abilities[id]?.hunterShotUsed
  })
  if (!hunterId) {
    return advancePastHunterShot(state, deathRecord)
  }
  const hunter = state.players.find(p => p.id === hunterId)!
  const alive = alivePlayers(state).filter(p => p.id !== hunterId).map(p => p.number)
  if (!alive.length) {
    return advancePastHunterShot(state, deathRecord)
  }
  try {
    const action = await decideNightAction(
      buildPlayerContext(hunter.id, state),
      config,
    )
    if (!action) {
      return advancePastHunterShot(state, deathRecord)
    }
    return handleSheriffTransfer(shootHunter(state, action.actorId, action.targetId), config)
  } catch {
    return advancePastHunterShot(state, deathRecord)
  }
}

function advancePastHunterShot(state: FullGameState, deathRecord?: FullGameState['deaths'][number]): FullGameState {
  const wasNightDeath = deathRecord?.cause === 'night'
  const nextPhase = wasNightDeath ? Phase.DayDiscussion : Phase.WolfDiscussion
  const nextRound = wasNightDeath ? state.round : state.round + 1
  const events = wasNightDeath
    ? [{ type: 'DayStarted' as const, round: nextRound, deaths: deathRecord?.playerIds ?? [] }, { type: 'DayDiscussionStarted' as const, round: nextRound }]
    : [{ type: 'NightStarted' as const, round: nextRound }, { type: 'WolfDiscussionStarted' as const, round: nextRound }]
  return {
    ...state,
    phase: nextPhase,
    round: nextRound,
    aiStatus: wasNightDeath ? '白天讨论' : '狼人夜聊',
    events: [...state.events, ...events],
  }
}

async function runKnightDuel(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  const knight = alivePlayers(state).find(p => p.role === Role.Knight && !state.abilities[p.id]?.knightDuelUsed)
  if (!knight) return startVote({ ...state, aiStatus: '进入投票' })
  const targets = alivePlayers(state).filter(p => p.id !== knight.id)
  if (!targets.length) return startVote({ ...state, aiStatus: '进入投票' })
  try {
    const decision = await decideKnightDuel(buildPlayerContext(knight.id, state), config)
    if (!decision.duel) return startVote({ ...state, aiStatus: '进入投票' })
    const next = knightDuel(state, knight.id, decision.targetId)
    if (next.winner) return next
    const withTransfer = await handleSheriffTransfer(next, config)
    return startVote({ ...withTransfer, aiStatus: '进入投票' })
  } catch {
    return startVote({ ...state, aiStatus: '进入投票' })
  }
}

async function runSheriffElection(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  const campaignTag = '警长竞选'
  const speakers = alivePlayers(state).filter(p =>
    !state.publicChat.some(m => m.round === state.round && m.playerId === p.id && m.tags?.includes(campaignTag))
  )
  if (speakers.length) {
    const speaker = speakers[0]
    const speech = await decideSheriffSpeech(buildPlayerContext(speaker.id, state), config)
    return addChat(
      { ...state, aiStatus: `警长竞选发言 (${speaker.number}号)` },
      { channel: 'public', playerId: speaker.id, content: speech, tags: [campaignTag] },
    )
  }

  const voters = alivePlayers(state).filter(p =>
    !state.events.some(e => e.type === 'VoteCast' && 'vote' in e && e.round === state.round && e.vote.voterId === p.id)
  )
  if (voters.length) {
    const results = await Promise.all(voters.map(voter =>
      decideSheriffVote(buildPlayerContext(voter.id, state), config)
        .then(result => ({ voterId: voter.id, targetId: result.targetId, reason: result.reason }))
        .catch(() => ({ voterId: voter.id, targetId: fallbackSheriffTargetId(state, voter.id), reason: '警长投票' as const }))
    ))
    let withVotes = state
    for (const vote of results) {
      withVotes = {
        ...withVotes,
        events: [...withVotes.events, { type: 'VoteCast' as const, round: state.round, vote }],
      }
    }
    return { ...withVotes, aiStatus: `警长投票完成 (${voters.length}人已投)` }
  }

  const votes = state.events
    .filter(e => e.type === 'VoteCast' && e.round === state.round)
    .map(e => (e as { type: 'VoteCast'; round: number; vote: { voterId: number; targetId: number } }).vote)
  const tally = new Map<number, number>()
  votes.forEach(v => tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + 1))
  let winnerId: number | null = null
  let maxVotes = 0
  tally.forEach((count, id) => {
    if (count > maxVotes) { winnerId = id; maxVotes = count }
  })
  const winnerPlayer = winnerId ? state.players.find(p => p.id === winnerId) : null
  const next = winnerId
    ? { ...state, sheriffId: winnerId, aiStatus: `${winnerPlayer?.number}号当选警长` }
    : { ...state, aiStatus: '警长竞选无人当选' }
  let final = {
    ...next,
    phase: Phase.DayDiscussion,
    events: [...next.events, { type: 'DayDiscussionStarted' as const, round: next.round }],
  }
  if (winnerId) {
    final = {
      ...final,
      events: [...final.events, { type: 'SheriffElected' as const, round: state.round, playerId: winnerId }],
    }
    final = addChat(final, { channel: 'system', content: `👑 ${winnerPlayer?.number}号${winnerPlayer?.name} 当选警长，拥有 1.5 票归票权`, tags: [] })
  }
  return final
}

function fallbackSheriffTargetId(state: FullGameState, selfId: number): number {
  const target = alivePlayers(state).find(p => p.id !== selfId)
  return target?.id ?? selfId
}

async function runPostGameDiscussion(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  const count = postGameCount(state)
  if (count >= 25) return { ...state, phase: Phase.GameOver, aiStatus: '赛后讨论结束' }
  const speaker = pickPostGameSpeaker(state)
  if (!speaker) return { ...state, phase: Phase.GameOver, aiStatus: '赛后讨论结束' }
  const speech = await decidePostGameSpeech(buildPlayerContext(speaker.id, state), config)
  return addChat(
    { ...state, aiStatus: `赛后自由讨论 ${count + 1}/25` },
    { channel: 'public', playerId: speaker.id, content: speech, tags: ['赛后'] },
  )
}

function postGameCount(state: FullGameState): number {
  return state.publicChat.filter(m => m.phase === Phase.PostGameDiscussion).length
}

function pickPostGameSpeaker(state: FullGameState) {
  const postGame = state.publicChat.filter(m => m.phase === Phase.PostGameDiscussion)
  const last = postGame.at(-1) ?? state.publicChat.at(-1)
  const recent = postGame.slice(-3).map(m => m.playerId)
  const lastTwo = postGame.slice(-2).map(m => m.playerId)
  const loopPair = lastTwo.length === 2 && lastTwo[0] !== lastTwo[1] && recent.every(id => id === lastTwo[0] || id === lastTwo[1])
  const mentioned = last?.content.match(/@?\s*(\d{1,2})\s*号?/)
  const mentionedPlayer = mentioned ? state.players.find(p => p.id === Number(mentioned[1]) && p.id !== last?.playerId) : undefined
  if (mentionedPlayer && (!loopPair || !lastTwo.includes(mentionedPlayer.id))) return mentionedPlayer
  const scores = state.players.map(player => {
    const ownCount = postGame.filter(m => m.playerId === player.id).length
    const wasRecent = recent.includes(player.id) ? 3 : 0
    const blame = state.winner === 'werewolf' && player.role !== Role.Werewolf ? 1 : 0
    const brag = state.winner === 'villager' && player.role === Role.Werewolf ? 1 : 0
    return { player, score: ownCount * 4 + wasRecent + Math.random() * 2 - blame - brag }
  })
  return scores.sort((a, b) => a.score - b.score)[0]?.player
}

async function runWolfDiscussion(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  let next = { ...state, aiStatus: '狼人夜聊中' }
  next = await linkCupidWithAI(next, config)
  const wolves = alivePlayers(next).filter(p => p.role === Role.Werewolf)
  if (!wolves.length) return handleSheriffTransfer(resolveNight({ ...next, aiStatus: '夜晚结算完成' }), config)

  // Count how many wolf chats this round
  const chatThisRound = next.wolfChat.filter(m => m.round === next.round).length
  const maxWolfRounds = wolves.length * 3  // each wolf can speak up to 3 times
  const allHaveSpoken = wolves.every(w => next.wolfChat.some(m => m.round === next.round && m.playerId === w.id))

  // Check if wolves have reached consensus via vote:X in recent chats
  const consensus = pickWolfVoteTarget(next)

  // If we have clear consensus and all spoke at least once, execute kill
  if (consensus && allHaveSpoken && !next.nightActions.some(a => a.actionType === 'kill')) {
    const captain = wolves[0]
    return submitNightAction(next, { actorId: captain.id, targetId: consensus, actionType: 'kill' })
  }

  // If max rounds reached but no consensus, force kill via captain
  if (chatThisRound >= maxWolfRounds && !next.nightActions.some(a => a.actionType === 'kill')) {
    const captain = wolves[0]
    const target = consensus ?? pickWolfChatTarget(next)
    if (target) return submitNightAction(next, { actorId: captain.id, targetId: target, actionType: 'kill' })
    const action = await decideNightAction(buildPlayerContext(captain.id, next), config)
    if (!action) return markNightSkipped(next, captain.id, '狼队夜间跳过击杀。')
    return submitNightAction(next, { ...action, actorId: captain.id, actionType: 'kill' })
  }

  // Continue discussion: pick next wolf speaker
  const nextWolfSpeaker = wolves.find(wolf => !next.wolfChat.some(m => m.round === next.round && m.playerId === wolf.id))
    ?? wolves[chatThisRound % wolves.length]  // round-robin after all spoke
  if (nextWolfSpeaker && chatThisRound < maxWolfRounds) {
    const speech = await decideWolfDiscussionSpeech(buildPlayerContext(nextWolfSpeaker.id, next), config)
    return addChat(next, { channel: 'wolf', playerId: nextWolfSpeaker.id, content: speech, tags: ['狼聊'] })
  }

  // Process non-wolf night actions
  if (next.nightActions.some(a => a.actionType === 'kill')) {
    const actors = alivePlayers(next)
      .filter(p => p.role !== Role.Werewolf && canActAtNight(p.role, next, p.id))
      .sort((a, b) => nightRoleOrder(a.role) - nightRoleOrder(b.role) || a.number - b.number)
    const nextActor = actors.find(actor => !next.nightActions.some(a => a.actorId === actor.id) && !wasNightSkipped(next, actor.id))
    if (nextActor) {
      const action = await decideNightAction(buildPlayerContext(nextActor.id, next), config)
      if (!action) return markNightSkipped(next, nextActor.id, `${nextActor.number}号夜间跳过行动。`)
      try {
        return submitNightAction(next, action)
      } catch {
        return markNightSkipped(next, nextActor.id, `${nextActor.number}号夜间行动无效，已跳过。`)
      }
    }
    return handleSheriffTransfer(resolveNight({ ...next, aiStatus: '夜晚结算完成' }), config)
  }

  return handleSheriffTransfer(resolveNight({ ...next, aiStatus: '夜晚结算完成' }), config)
}

function pickWolfVoteTarget(state: FullGameState): number | null {
  const aliveIds = new Set(alivePlayers(state).map(p => p.id))
  const wolfIds = new Set(alivePlayers(state).filter(p => p.role === Role.Werewolf).map(p => p.id))
  const counts = new Map<number, number>()
  state.wolfChat.filter(m => m.round === state.round).forEach(message => {
    const match = message.content.match(/vote\s*[:：]\s*(\d+)/i)
    if (match) {
      const targetId = state.players.find(p => p.number === Number(match[1]))?.id
      if (targetId && aliveIds.has(targetId) && !wolfIds.has(targetId)) {
        counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
      }
    }
  })
  let target: number | null = null
  let max = 0
  counts.forEach((count, id) => { if (count > max) { target = id; max = count } })
  return max >= Math.ceil(alivePlayers(state).filter(p => p.role === Role.Werewolf).length / 2) ? target : null  // majority
}

async function linkCupidWithAI(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  if (state.round !== 1 || state.lovers.length) return state
  const cupid = alivePlayers(state).find(p => p.role === Role.Cupid)
  if (!cupid || state.abilities[cupid.id].cupidLinked) return state
  try {
    const result = await decideCupidLink(buildPlayerContext(cupid.id, state), config)
    if (!result) return state
    return linkCupidLovers(state, cupid.id, result.loverIds)
  } catch {
    return state
  }
}

function pickWolfChatTarget(state: FullGameState): number | null {
  const aliveIds = new Set(alivePlayers(state).map(p => p.id))
  const wolfIds = new Set(alivePlayers(state).filter(p => p.role === Role.Werewolf).map(p => p.id))
  const counts = new Map<number, number>()
  state.wolfChat.filter(m => m.round === state.round).forEach(message => {
    const candidates = [...message.content.matchAll(/(?:刀|杀|砍|咬|击杀|目标|出|票|冲)\s*(\d{1,2})\s*号?/g)]
      .map(match => Number(match[1]))
      .filter(id => aliveIds.has(id) && !wolfIds.has(id))
    candidates.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1))
  })
  let target: number | null = null
  let max = 0
  counts.forEach((count, id) => {
    if (count > max) {
      target = id
      max = count
    }
  })
  return target
}

function nightRoleOrder(role: Role): number {
  if (role === Role.Guard) return 1
  if (role === Role.Witch) return 2
  if (role === Role.Seer) return 3
  return 9
}

async function runDayDiscussion(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  const next = { ...state, aiStatus: '白天讨论中' }
  const speaker = alivePlayers(next).find(player => !next.publicChat.some(m => m.round === next.round && m.playerId === player.id))
  if (speaker) {
    const speech = await decideDaySpeech(buildPlayerContext(speaker.id, next), config)
    return addChat(next, { channel: 'public', playerId: speaker.id, content: speech, tags: tagSpeech(speech) })
  }
  const knight = alivePlayers(next).find(p => p.role === Role.Knight && !next.abilities[p.id]?.knightDuelUsed)
  if (knight && alivePlayers(next).some(p => p.id !== knight.id)) {
    return { ...next, phase: Phase.KnightDuel, aiStatus: '骑士决斗' }
  }
  // All spoke once → enter free discussion
  return { ...next, phase: Phase.FreeDiscussion, aiStatus: '自由讨论' }
}

async function runFreeDiscussion(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  const next = { ...state, aiStatus: '自由讨论' }
  const freeChatsThisRound = next.publicChat.filter(m => m.round === next.round && m.phase === 'freeDiscussion').length
  const maxFreeChats = alivePlayers(next).length * 2  // up to 2 extra rounds
  if (freeChatsThisRound >= maxFreeChats) {
    return startVote({ ...next, aiStatus: '进入投票' })
  }
  // Round-robin: pick next player who hasn't spoken in free discussion yet this round
  const speaker = alivePlayers(next).find(player =>
    !next.publicChat.some(m => m.round === next.round && m.playerId === player.id && m.phase === 'freeDiscussion')
  )
    ?? alivePlayers(next)[freeChatsThisRound % alivePlayers(next).length]
  if (speaker) {
    const speech = await decideFreeDiscussionSpeech(buildPlayerContext(speaker.id, next), config)
    if (speech === '过' || !speech.trim()) {
      return addChat(next, { channel: 'system', playerId: speaker.id, content: `${speaker.number}号跳过自由讨论`, tags: [] })
    }
    return addChat(next, { channel: 'public', playerId: speaker.id, content: speech, tags: ['自由讨论'] })
  }
  return startVote({ ...next, aiStatus: '进入投票' })
}

async function runVote(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  let next = { ...state, aiStatus: '投票中' }
  const voters = alivePlayers(next).filter(player => !next.votes.some(v => v.voterId === player.id) && !wasVoteSkipped(next, player.id))
  if (voters.length) {
    const baseState = next
    const results = await Promise.all(voters.map(voter =>
      decideVote(buildPlayerContext(voter.id, baseState), config)
        .then(vote => ({ ok: true as const, voterId: voter.id, voterNumber: voter.number, vote }))
        .catch(() => ({ ok: false as const, voterId: voter.id, voterNumber: voter.number }))
    ))
    for (const r of results) {
      if (r.ok) {
        try {
          next = castVote(next, r.vote)
        } catch {
          const skipped = skipVote(next, r.voterId, '投票失败')
          next = addChat(skipped, { channel: 'system', content: `${r.voterNumber}号投票无效，已跳过。`, tags: ['投票失败'] })
        }
      } else {
        const skipped = skipVote(next, r.voterId, '投票失败')
        next = addChat(skipped, { channel: 'system', content: `${r.voterNumber}号投票无效，已跳过。`, tags: ['投票失败'] })
      }
    }
    return next
  }
  return handleSheriffTransfer(resolveVote({ ...next, aiStatus: '投票结算完成' }), config)
}

function markNightSkipped(state: FullGameState, actorId: number, content: string): FullGameState {
  return skipNightAction(state, actorId, content)
}

function wasNightSkipped(state: FullGameState, actorId: number): boolean {
  return state.events.some(e => e.type === 'NightActionSkipped' && e.round === state.round && e.actorId === actorId)
}

function wasVoteSkipped(state: FullGameState, voterId: number): boolean {
  return state.events.some(e => e.type === 'VoteSkipped' && e.round === state.round && e.voterId === voterId)
}

function canActAtNight(role: Role, state: FullGameState, playerId: number): boolean {
  if (role === Role.Werewolf || role === Role.Seer || role === Role.Guard) return true
  if (role !== Role.Witch) return false
  const ability = state.abilities[playerId]
  return !ability.witchPoisonUsed || !ability.witchAntidoteUsed
}

async function submitPendingLastWords(state: FullGameState, config: AIConfig): Promise<FullGameState> {
  const deadId = state.deaths.flatMap(record => record.playerIds).find(id => !state.lastWords[id])
  if (!deadId) return state
  const player = state.players.find(p => p.id === deadId)
  if (!player || player.isAlive) return state
  try {
    const context = buildPlayerContext(deadId, state)
    const speech = await decideLastWords(context, config)
    return submitLastWords(state, deadId, `${player.number}号遗言：${speech}`)
  } catch {
    // fallback: role-based generic last words
    const fallback = player.role === Role.Werewolf
      ? '我是好人，请大家仔细看票型。'
      : player.role === Role.Seer
        ? '记住我的查验，不要被狼人带偏。'
        : '好人加油，仔细看发言找狼。'
    return submitLastWords(state, deadId, `${player.number}号遗言：${fallback}`)
  }
}

function tagSpeech(content: string): string[] {
  const tags: string[] = []
  if (/狼|刀|冲票|带节奏/.test(content)) tags.push('攻击')
  if (/预言家|女巫|猎人|守卫|身份/.test(content)) tags.push('身份')
  if (/保|相信|站边/.test(content)) tags.push('互保')
  return tags
}

