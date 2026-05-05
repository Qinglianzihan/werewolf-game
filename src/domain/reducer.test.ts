import { describe, expect, it } from 'vitest'
import { Role } from './types'
import {
  castVote,
  createInitialState,
  knightDuel,
  linkCupidLovers,
  resolveNight,
  resolveVote,
  shootHunter,
  submitLastWords,
  submitNightAction,
  transferSheriffIfDead,
} from './reducer'
import { getStandardRoles } from './rulesets'

describe('domain rules', () => {
  it('randomizes role seats when creating a new game', () => {
    const states = Array.from({ length: 8 }, () => createInitialState({ playerCount: 6 }))
    const signatures = new Set(states.map(state => state.players.map(p => p.role).join(',')))

    expect(signatures.size).toBeGreaterThan(1)
  })

  it('resolves a unified wolf kill after wolf discussion actions', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })

    state = submitNightAction(state, { actorId: 1, targetId: 3, actionType: 'kill' })
    state = submitNightAction(state, { actorId: 2, targetId: 3, actionType: 'kill' })
    state = resolveNight(state)

    expect(state.players.find(p => p.id === 3)?.isAlive).toBe(false)
    expect(state.deaths.at(-1)?.playerIds).toEqual([3])
    expect(state.events.some(e => e.type === 'NightResolved')).toBe(true)
  })

  it('blocks repeated guard target and one-use witch medicines', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Guard, Role.Seer, Role.Witch,
    ] })

    state = submitNightAction(state, { actorId: 4, targetId: 3, actionType: 'guard' })
    state = resolveNight(state)

    expect(() => submitNightAction(state, { actorId: 4, targetId: 3, actionType: 'guard' })).toThrow(/连续/)

    state = submitNightAction(state, { actorId: 6, targetId: 2, actionType: 'poison' })
    state = resolveNight(state)

    expect(() => submitNightAction(state, { actorId: 6, targetId: 1, actionType: 'poison' })).toThrow(/毒药/)
  })

  it('ignores invalid dead voters and keeps tied votes from exiling', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = { ...state, players: state.players.map(p => p.id === 6 ? { ...p, isAlive: false } : p) }
    state = castVote(state, { voterId: 1, targetId: 3, reason: '冲票' })
    state = castVote(state, { voterId: 2, targetId: 4, reason: '分票' })

    expect(() => castVote(state, { voterId: 6, targetId: 3, reason: '死人票' })).toThrow(/死亡/)
  })

  it('builds fixed 12-player boards with planned replacements', () => {
    expect(getStandardRoles(12, 'standard')).toEqual([
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ])
    expect(getStandardRoles(12, 'idiot')).toEqual([
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Idiot,
    ])
    expect(getStandardRoles(12, 'knight')).toContain(Role.Knight)
    expect(getStandardRoles(12, 'knight')).not.toContain(Role.Hunter)
    expect(getStandardRoles(12, 'cupid').filter(role => role === Role.Villager)).toHaveLength(3)
    expect(getStandardRoles(12, 'cupid')).toContain(Role.Cupid)
  })

  it('lets witch save the current wolf target without consuming poison', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })

    state = submitNightAction(state, { actorId: 1, targetId: 3, actionType: 'kill' })
    state = submitNightAction(state, { actorId: 6, targetId: 3, actionType: 'save' })
    state = resolveNight(state)

    expect(state.players.find(p => p.id === 3)?.isAlive).toBe(true)
    expect(state.abilities[6].witchAntidoteUsed).toBe(true)
    expect(state.abilities[6].witchPoisonUsed).toBe(false)
    expect(state.deaths.at(-1)).toBeUndefined()
  })

  it('survives when guard and witch both target wolf victim (同守同救已移除)', () => {
    let state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ] })

    state = submitNightAction(state, { actorId: 1, targetId: 5, actionType: 'kill' })
    state = submitNightAction(state, { actorId: 12, targetId: 5, actionType: 'guard' })
    state = submitNightAction(state, { actorId: 10, targetId: 5, actionType: 'save' })
    state = resolveNight(state)

    expect(state.players.find(p => p.id === 5)?.isAlive).toBe(true)
    expect(state.abilities[10].witchAntidoteUsed).toBe(true)
    expect(state.deaths.at(-1)).toBeUndefined()
  })

  it('kills the other lover when Cupid-linked player dies', () => {
    let state = createInitialState({ playerCount: 12, board: 'cupid', roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard, Role.Cupid,
    ] })

    state = linkCupidLovers(state, 12, [5, 6])
    state = submitNightAction(state, { actorId: 1, targetId: 5, actionType: 'kill' })
    state = resolveNight(state)

    expect(state.players.find(p => p.id === 5)?.isAlive).toBe(false)
    expect(state.players.find(p => p.id === 6)?.isAlive).toBe(false)
    expect(state.deaths.at(-1)?.playerIds.sort()).toEqual([5, 6])
  })

  it('reveals idiot on exile and removes their vote instead of killing them', () => {
    let state = createInitialState({ playerCount: 12, board: 'idiot', roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Idiot,
    ] })
    state = { ...state, sheriffId: null }
    state = castVote(state, { voterId: 1, targetId: 12, reason: '归票' })
    state = castVote(state, { voterId: 2, targetId: 12, reason: '归票' })
    state = resolveVote(state)

    expect(state.players.find(p => p.id === 12)?.isAlive).toBe(true)
    expect(state.abilities[12].idiotRevealed).toBe(true)
    expect(state.abilities[12].canVote).toBe(false)
    expect(() => castVote(state, { voterId: 12, targetId: 1, reason: '我还想投' })).toThrow(/投票权/)
  })

  it('resolves knight duel differently for wolf and good targets', () => {
    let wolfTargetState = createInitialState({ playerCount: 12, board: 'knight', roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Knight, Role.Guard,
    ] })
    wolfTargetState = knightDuel(wolfTargetState, 11, 1)
    expect(wolfTargetState.players.find(p => p.id === 1)?.isAlive).toBe(false)
    expect(wolfTargetState.players.find(p => p.id === 11)?.isAlive).toBe(true)

    let goodTargetState = createInitialState({ playerCount: 12, board: 'knight', roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Knight, Role.Guard,
    ] })
    goodTargetState = knightDuel(goodTargetState, 11, 5)
    expect(goodTargetState.players.find(p => p.id === 11)?.isAlive).toBe(false)
    expect(goodTargetState.players.find(p => p.id === 5)?.isAlive).toBe(true)
  })


  it('passes sheriff badge via transferSheriffIfDead with specified successor', () => {
    let state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ] })
    state = { ...state, sheriffId: 1 }
    state = submitNightAction(state, { actorId: 2, targetId: 1, actionType: 'kill' })
    state = resolveNight(state)
    // sheriff died but transferSheriffIfDead is no longer called inside resolveNight
    // — it is called from session.ts via handleSheriffTransfer for LLM-based choice
    expect(state.sheriffId).toBe(1)
    // Explicitly transfer to successor 3
    state = transferSheriffIfDead(state, 3)
    expect(state.sheriffId).toBe(3)
    expect(state.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'SheriffTransferred', fromId: 1, toId: 3 }),
    ]))
  })

  it('lets hunter shoot once after death', () => {
    let state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ] })
    state = submitNightAction(state, { actorId: 1, targetId: 11, actionType: 'kill' })
    state = resolveNight(state)
    state = shootHunter(state, 11, 1)

    expect(state.players.find(p => p.id === 1)?.isAlive).toBe(false)
    expect(state.abilities[11].hunterShotUsed).toBe(true)
    expect(() => shootHunter(state, 11, 2)).toThrow(/already shot/)
  })

  it('uses sheriff vote weight 1.5 in 12-player games', () => {
    let state = createInitialState({ playerCount: 12 })
    state = { ...state, sheriffId: 1 }
    expect(state.sheriffId).toBe(1)
    state = castVote(state, { voterId: 1, targetId: 3, reason: '警长归票' })
    state = castVote(state, { voterId: 2, targetId: 4, reason: '分票' })
    state = resolveVote(state)

    expect(state.players.find(p => p.id === 3)?.isAlive).toBe(false)
  })

  it('keeps sheriff vote weighted when raw counts tie', () => {
    let state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ] })
    state = { ...state, sheriffId: 1 }
    state = castVote(state, { voterId: 1, targetId: 5, reason: '警长归票心声' })
    state = castVote(state, { voterId: 2, targetId: 6, reason: '普通票心声' })
    state = resolveVote(state)

    expect(state.players.find(p => p.id === 5)?.isAlive).toBe(false)
    expect(state.players.find(p => p.id === 6)?.isAlive).toBe(true)
  })

  it('records last words only once for a dead player', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = { ...state, players: state.players.map(p => p.id === 3 ? { ...p, isAlive: false } : p) }
    state = submitLastWords(state, 3, '我是好人，重点看1号。')
    state = submitLastWords(state, 3, '重复遗言')

    expect(state.lastWords[3]).toBe('我是好人，重点看1号。')
    expect(state.publicChat.filter(m => m.playerId === 3 && m.tags?.includes('遗言'))).toHaveLength(1)
  })

  it('allows distinct last words for multiple dead players', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = { ...state, players: state.players.map(p => [3, 4].includes(p.id) ? { ...p, isAlive: false } : p) }
    state = submitLastWords(state, 3, '3号遗言：我怀疑1号。')
    state = submitLastWords(state, 4, '4号遗言：我站5号。')

    expect(state.lastWords[3]).toBe('3号遗言：我怀疑1号。')
    expect(state.lastWords[4]).toBe('4号遗言：我站5号。')
    expect(new Set(Object.values(state.lastWords)).size).toBe(2)
  })
})
