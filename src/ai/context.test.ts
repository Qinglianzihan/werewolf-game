import { describe, expect, it } from 'vitest'
import { Role } from '../domain/types'
import { addChat, castVote, createInitialState, resolveNight, submitNightAction } from '../domain/reducer'
import { buildGodView, buildPlayerContext } from './context'
import { serializeContextForPrompt } from './agent'

describe('AI context isolation and god view', () => {
  it('gives villagers no hidden identities while god view sees everything', () => {
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })

    const villager = buildPlayerContext(3, state)
    const god = buildGodView(state)

    expect(villager.self.role).toBe(Role.Villager)
    expect(villager.players.find(p => p.id === 1)?.role).toBeUndefined()
    expect(god.players.find(p => p.id === 1)?.role).toBe(Role.Werewolf)
  })

  it('carries wolf partners and wolf channel only for werewolves', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = {
      ...state,
      wolfChat: [{ id: 'w1', channel: 'wolf', playerId: 1, content: '今晚刀3', round: 1, phase: 'wolfDiscussion' }],
    }
    state = submitNightAction(state, { actorId: 5, targetId: 1, actionType: 'check' })

    const wolf = buildPlayerContext(1, state)
    const seer = buildPlayerContext(5, state)
    const villager = buildPlayerContext(3, state)

    expect(wolf.wolfPartners.map(p => p.id)).toEqual([2])
    expect(wolf.wolfChat).toHaveLength(1)
    expect(seer.seerChecks).toEqual([{ targetId: 1, alignment: 'werewolf', round: 1 }])
    expect(villager.wolfChat).toEqual([])
  })

  it('does not reveal special good roles to werewolves', () => {
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })

    const wolf = buildPlayerContext(1, state)

    expect(wolf.players.find(p => p.id === 2)?.role).toBe(Role.Werewolf)
    expect(wolf.players.find(p => p.id === 3)?.role).toBeUndefined()
    expect(wolf.players.find(p => p.id === 4)?.role).toBeUndefined()
  })

  it('does not expose other players personalities in AI prompt context', () => {
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })

    const wolfPrompt = serializeContextForPrompt(buildPlayerContext(1, state), 'test')
    const parsed = JSON.parse(wolfPrompt)

    expect(parsed.privateKnowledge.wolfPartners[0].personality).toBeUndefined()
    expect(parsed.table.players.every((p: { personality?: string }) => p.personality === undefined)).toBe(true)
    expect(wolfPrompt).not.toContain('预言家')
    expect(wolfPrompt).not.toContain('女巫')
    expect(wolfPrompt).not.toContain('"role":"seer"')
    expect(wolfPrompt).not.toContain('"role":"witch"')
    expect(wolfPrompt).not.toContain('谨慎逻辑型')
    expect(wolfPrompt).not.toContain('情绪煽动型')
    expect(parsed.completeHistory.events[0].players.every((p: { role?: Role; personality?: string }) =>
      p.role === undefined || p.role === Role.Werewolf,
    )).toBe(true)
    expect(parsed.completeHistory.events[0].players.every((p: { personality?: string }) => p.personality === undefined)).toBe(true)
  })

  it('carries complete uncompressed structured history for allowed information', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = addChat(state, { channel: 'wolf', playerId: 1, content: '第一晚刀3，白天踩4', tags: ['策略'] })
    state = submitNightAction(state, { actorId: 1, targetId: 3, actionType: 'kill' })
    state = submitNightAction(state, { actorId: 2, targetId: 3, actionType: 'kill' })
    state = submitNightAction(state, { actorId: 5, targetId: 1, actionType: 'check' })
    state = resolveNight(state)
    state = addChat(state, { channel: 'public', playerId: 4, content: '我觉得1号发言太像狼了', tags: ['攻击'] })
    state = castVote(state, { voterId: 4, targetId: 1, reason: '发言像狼' })

    const wolf = buildPlayerContext(1, state)
    const villager = buildPlayerContext(4, state)

    expect(wolf.history.events.map(e => e.type)).toContain('NightActionSubmitted')
    expect(wolf.history.nightActionHistory).toHaveLength(2)
    expect(wolf.history.voteHistory).toHaveLength(1)
    expect(wolf.history.publicChat).toHaveLength(1)
    expect(wolf.history.wolfChat).toHaveLength(1)
    expect(villager.history.wolfChat).toHaveLength(0)
    expect(villager.history.nightActionHistory).toHaveLength(0)
    expect(villager.history.events.some(e => e.type === 'NightActionSubmitted')).toBe(false)
  })

  it('keeps AI identities isolated across all planned boards', () => {
    const boards = [
      { playerCount: 6 as const },
      { playerCount: 9 as const },
      { playerCount: 12 as const, board: 'standard' as const },
      { playerCount: 12 as const, board: 'idiot' as const },
      { playerCount: 12 as const, board: 'knight' as const },
      { playerCount: 12 as const, board: 'cupid' as const },
    ]

    boards.forEach(config => {
      const state = createInitialState(config)
      const nonWolf = state.players.find(p => p.role !== Role.Werewolf)!
      const nonWolfContext = buildPlayerContext(nonWolf.id, state)
      const wolf = state.players.find(p => p.role === Role.Werewolf)!
      const wolfContext = buildPlayerContext(wolf.id, state)

      expect(nonWolfContext.players.filter(p => p.role && p.id !== nonWolf.id)).toHaveLength(0)
      expect(wolfContext.players.every(p => !p.role || p.role === Role.Werewolf)).toBe(true)
    })
  })

  it('shows current wolf kill target only to witch private context', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = submitNightAction(state, { actorId: 1, targetId: 3, actionType: 'kill' })

    const witch = buildPlayerContext(6, state)
    const seer = buildPlayerContext(5, state)

    expect(witch.witch.currentKillTargetId).toBe(3)
    expect(witch.witch.currentKillTargetNumber).toBe(3)
    expect(seer.witch.currentKillTargetId).toBeNull()
  })

  it('converts seer checks to alignment only and hides vote reasons from other players', () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Guard, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = submitNightAction(state, { actorId: 5, targetId: 3, actionType: 'check' })
    state = castVote(state, { voterId: 3, targetId: 1, reason: '我的心声理由' })

    const seer = buildPlayerContext(5, state)
    const villager = buildPlayerContext(4, state)

    expect(seer.seerChecks).toEqual([{ targetId: 3, alignment: 'good', round: 1 }])
    expect(JSON.stringify(seer)).not.toContain('"role":"guard"')
    expect(villager.publicVotes[0]).toEqual({ voterId: 3, targetId: 1 })
    expect(villager.history.voteHistory[0]).toEqual({ voterId: 3, targetId: 1 })
    expect(JSON.stringify(villager)).not.toContain('我的心声理由')
  })
})
