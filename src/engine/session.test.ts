import { describe, expect, it } from 'vitest'
import { createInitialState } from '../domain/reducer'
import { Role } from '../domain/types'
import { runSessionStep } from './session'
import type { AIConfig } from '../ai/types'

const noModel: AIConfig = { providers: [], activeProviderId: '', activeModel: '' }

describe('session runner', () => {
  it('fallback AI can advance a 6-player game without blocking', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })

    for (let i = 0; i < 8 && !state.winner; i++) {
      state = await runSessionStep(state, noModel)
    }

    expect(state.events.length).toBeGreaterThan(5)
    expect(state.publicChat.length + state.wolfChat.length).toBeGreaterThan(0)
  })

  it('does not advance while paused', async () => {
    const state = { ...createInitialState({ playerCount: 6 }), isPaused: true }
    const next = await runSessionStep(state, noModel)

    expect(next.events).toHaveLength(state.events.length)
  })

  it('emits wolf chat, day speeches, and votes one at a time', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })

    state = await runSessionStep(state, noModel)
    expect(state.wolfChat).toHaveLength(1)
    expect(state.nightActions).toHaveLength(0)

    state = await runSessionStep(state, noModel)
    expect(state.wolfChat).toHaveLength(2)
    expect(state.nightActions).toHaveLength(0)
  })

  it('submits exactly one unified wolf kill before other night roles act', async () => {
    let state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Villager, Role.Witch, Role.Werewolf, Role.Seer, Role.Hunter,
      Role.Villager, Role.Werewolf, Role.Guard, Role.Villager, Role.Werewolf, Role.Villager,
    ] })
    // Pre-fill wolf chat with vote:X consensus + enough messages to reach maxWolfRounds (12)
    state = {
      ...state,
      wolfChat: [
        { id: 'w1', channel: 'wolf' as const, playerId: 1, content: '刀12暗香。vote:12', round: 1, phase: 'wolfDiscussion' },
        { id: 'w4', channel: 'wolf' as const, playerId: 4, content: 'vote:12', round: 1, phase: 'wolfDiscussion' },
        { id: 'w8', channel: 'wolf' as const, playerId: 8, content: 'vote:12', round: 1, phase: 'wolfDiscussion' },
        { id: 'w11', channel: 'wolf' as const, playerId: 11, content: 'vote:3', round: 1, phase: 'wolfDiscussion' },
        { id: 'w1b', channel: 'wolf' as const, playerId: 1, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w4b', channel: 'wolf' as const, playerId: 4, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w8b', channel: 'wolf' as const, playerId: 8, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w11b', channel: 'wolf' as const, playerId: 11, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w1c', channel: 'wolf' as const, playerId: 1, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w4c', channel: 'wolf' as const, playerId: 4, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w8c', channel: 'wolf' as const, playerId: 8, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w11c', channel: 'wolf' as const, playerId: 11, content: '.', round: 1, phase: 'wolfDiscussion' },
      ],
    }

    state = await runSessionStep(state, noModel)
    expect(state.nightActions).toEqual([{ actorId: 1, targetId: 12, actionType: 'kill' }])

    state = await runSessionStep(state, noModel)
    const actionTypes = state.nightActions.map(a => a.actionType)
    expect(actionTypes).toContain('kill')
    expect(actionTypes).toContain('guard')
    expect(state.nightActions.filter(a => a.actionType === 'kill')).toHaveLength(1)
  })

  it('reaches voting phase from a fresh 6-player game', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })

    for (let i = 0; i < 30 && state.phase !== 'vote' && state.phase !== 'freeDiscussion' && !state.winner; i++) {
      state = await runSessionStep(state, noModel)
    }

    expect(['vote', 'freeDiscussion']).toContain(state.phase)
  })

  it('resolves voting and continues into next wolf discussion', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })

    for (let i = 0; i < 50 && state.round === 1 && !state.winner; i++) {
      state = await runSessionStep(state, noModel)
    }

    expect(state.round).toBeGreaterThanOrEqual(1)
    expect(state.phase).not.toBe('night')
    if (!state.winner) expect(['wolfDiscussion', 'freeDiscussion', 'vote', 'dayDiscussion']).toContain(state.phase)
  })

  it('casts all pending votes in one step', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = { ...state, phase: 'vote' }

    state = await runSessionStep(state, noModel)

    expect(state.votes).toHaveLength(6)
  })

  it('does not get stuck retrying a witch with no legal fallback action', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    // Pre-fill enough wolf chat to reach maxWolfRounds (2 wolves * 3 = 6)
    state = {
      ...state,
      wolfChat: [
        { id: 'w1', channel: 'wolf' as const, playerId: 1, content: '先刀3号。vote:3', round: 1, phase: 'wolfDiscussion' },
        { id: 'w2', channel: 'wolf' as const, playerId: 2, content: '支持刀3。vote:3', round: 1, phase: 'wolfDiscussion' },
        { id: 'w1b', channel: 'wolf' as const, playerId: 1, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w2b', channel: 'wolf' as const, playerId: 2, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w1c', channel: 'wolf' as const, playerId: 1, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w2c', channel: 'wolf' as const, playerId: 2, content: '.', round: 1, phase: 'wolfDiscussion' },
      ],
      nightActions: [
        { actorId: 1, targetId: 3, actionType: 'kill' },
        { actorId: 2, targetId: 3, actionType: 'kill' },
        { actorId: 5, targetId: 1, actionType: 'check' },
      ],
      abilities: {
        ...state.abilities,
        6: { ...state.abilities[6], witchPoisonUsed: true, witchAntidoteUsed: false },
      },
    }

    state = await runSessionStep(state, noModel)
    // Step 1: non-wolf processing begins (witch skipped)
    state = await runSessionStep(state, noModel)
    // Step 2: all non-wolves done → resolveNight
    expect(state.phase).toBe('dayDiscussion')
  })


  it('orders automatic night roles as guard before witch before seer after wolf kill', async () => {
    let state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ] })
    // Pre-fill 12 wolf chats (maxWolfRounds for 4 wolves) with vote:5 consensus
    state = {
      ...state,
      wolfChat: [
        { id: 'w1', channel: 'wolf' as const, playerId: 1, content: 'vote:5', round: 1, phase: 'wolfDiscussion' },
        { id: 'w2', channel: 'wolf' as const, playerId: 2, content: 'vote:5', round: 1, phase: 'wolfDiscussion' },
        { id: 'w3', channel: 'wolf' as const, playerId: 3, content: 'vote:5', round: 1, phase: 'wolfDiscussion' },
        { id: 'w4', channel: 'wolf' as const, playerId: 4, content: 'vote:5', round: 1, phase: 'wolfDiscussion' },
        { id: 'w1b', channel: 'wolf' as const, playerId: 1, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w2b', channel: 'wolf' as const, playerId: 2, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w3b', channel: 'wolf' as const, playerId: 3, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w4b', channel: 'wolf' as const, playerId: 4, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w1c', channel: 'wolf' as const, playerId: 1, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w2c', channel: 'wolf' as const, playerId: 2, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w3c', channel: 'wolf' as const, playerId: 3, content: '.', round: 1, phase: 'wolfDiscussion' },
        { id: 'w4c', channel: 'wolf' as const, playerId: 4, content: '.', round: 1, phase: 'wolfDiscussion' },
      ],
    }

    // Step 1: consensus reached, kill submitted
    state = await runSessionStep(state, noModel)
    // Step 2: maxWolfRounds hit with kill existing, process guard
    state = await runSessionStep(state, noModel)
    // Step 3: process witch (skipped due to noModel)
    state = await runSessionStep(state, noModel)
    // Step 4: process seer
    state = await runSessionStep(state, noModel)

    expect(state.events.filter(e => e.type === 'NightActionSubmitted').map(e => e.action.actionType)).toEqual(['kill', 'guard', 'check'])
    expect(state.events.filter(e => e.type === 'NightActionSkipped').map(e => e.actorId)).toEqual([10])
  })

  it('skips Cupid linking gracefully when AI is unavailable', async () => {
    let state = createInitialState({ playerCount: 12, board: 'cupid', roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard, Role.Cupid,
    ] })

    state = await runSessionStep(state, noModel)

    expect(state.lovers).toHaveLength(0)
  })

  it('submits one automatic last words message for the first dead player', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = {
      ...state,
      phase: 'dayDiscussion',
      players: state.players.map(p => p.id === 3 ? { ...p, isAlive: false } : p),
      deaths: [{ round: 1, playerIds: [3], cause: 'night' }],
    }

    state = await runSessionStep(state, noModel)
    state = await runSessionStep(state, noModel)

    expect(state.lastWords[3]).toBeTruthy()
    expect(state.publicChat.filter(m => m.playerId === 3 && m.tags?.includes('遗言'))).toHaveLength(1)
  })

  it('submits distinct automatic last words for multiple deaths', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = {
      ...state,
      phase: 'dayDiscussion',
      players: state.players.map(p => [3, 4].includes(p.id) ? { ...p, isAlive: false } : p),
      deaths: [{ round: 1, playerIds: [3, 4], cause: 'night' }],
    }

    state = await runSessionStep(state, noModel)
    state = await runSessionStep(state, noModel)

    expect(state.lastWords[3]).toContain('3号遗言')
    expect(state.lastWords[4]).toContain('4号遗言')
    expect(state.lastWords[3]).not.toBe(state.lastWords[4])
  })
})

