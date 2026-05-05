import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Role } from '../domain/types'
import { createInitialState, submitNightAction } from '../domain/reducer'
import { buildPlayerContext } from './context'
import { decideDaySpeech, decideNightAction, decidePostGameSpeech, decideVote, decideWolfDiscussionSpeech } from './agent'
import { readLogSession, startLogSession } from '../debug/gameLogger'
import type { AIConfig } from './types'


class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

describe('AI agent timing', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof localStorage === 'undefined') vi.stubGlobal('localStorage', new MemoryStorage())
    if (typeof window === 'undefined') vi.stubGlobal('window', new EventTarget())
    localStorage.clear()
  })

  it('sends DeepSeek thinking parameters exactly as official docs require', async () => {
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'vote:2:发言前后摇摆' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await decideVote(buildPlayerContext(3, state), {
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      providers: [{
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: ['deepseek-v4-pro'],
        thinkingEnabled: true,
        reasoningEffort: 'high',
      }],
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body).toMatchObject({
      model: 'deepseek-v4-pro',
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
      stream: false,
    })
    expect(body).not.toHaveProperty('max_tokens')
    expect(body).not.toHaveProperty('temperature')
    fetchMock.mockRestore()
  })

  it('waits longer for thinking models instead of falling back at 30s', async () => {
    vi.useFakeTimers()
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })
    const config: AIConfig = {
      activeProviderId: 'thinking',
      activeModel: 'reasoner',
      providers: [{
        id: 'thinking',
        name: 'Thinking',
        baseUrl: 'https://example.test',
        apiKey: 'key',
        models: ['reasoner'],
        thinkingEnabled: true,
        reasoningEffort: 'high',
      }],
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      setTimeout(() => resolve(new Response(JSON.stringify({
        choices: [{ message: { content: 'vote:2:他一直在顺着别人视角投机' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })), 31_000)
    }))

    const promise = decideVote(buildPlayerContext(3, state), config)
    await vi.advanceTimersByTimeAsync(31_000)

    await expect(promise).resolves.toMatchObject({ voterId: 3, targetId: 2, reason: '他一直在顺着别人视角投机' })
    expect(fetchMock).toHaveBeenCalledOnce()
    fetchMock.mockRestore()
    vi.useRealTimers()
  })

  it('logs a warning when wolf discussion uses fallback', async () => {
    const { decideWolfDiscussionSpeech } = await import('./agent')
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const speech = await decideWolfDiscussionSpeech(buildPlayerContext(1, state), { providers: [], activeProviderId: '', activeModel: '' })

    expect(speech).toContain('先压刀')
    expect(warn).toHaveBeenCalledWith('[AI fallback]', expect.objectContaining({
      task: 'wolfDiscussion',
      player: '1号 墨渊',
      role: Role.Werewolf,
      reason: 'No active provider',
    }))
    warn.mockRestore()
  })

  it('records reasoning length when DeepSeek returns empty final content', async () => {
    startLogSession()
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '', reasoning_content: '????'.repeat(10) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const vote = await decideVote(buildPlayerContext(3, state), {
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      providers: [{
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: ['deepseek-v4-pro'],
        thinkingEnabled: true,
        reasoningEffort: 'max',
      }],
    })

    expect(vote.reason).toBe('这轮行为链最不自然')
    const success = readLogSession().apiLogs.find(log => log.status === 'success')
    expect(success?.response).toMatchObject({ content: '', reasoningLength: 40 })
    expect(fetchMock).toHaveBeenCalledOnce()
    fetchMock.mockRestore()
    warn.mockRestore()
  })

  it('logs empty night action fallback and lets witch skip instead of default poisoning', async () => {
    startLogSession()
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '', reasoning_content: '??????' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const action = await decideNightAction(buildPlayerContext(4, state), {
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      providers: [{
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: ['deepseek-v4-pro'],
        thinkingEnabled: true,
        reasoningEffort: 'max',
      }],
    })

    expect(action).toBeNull()
    expect(readLogSession().apiLogs).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'fallback', task: 'nightAction', error: 'empty response' }),
    ]))
    fetchMock.mockRestore()
    warn.mockRestore()
  })

  it('prompts witch with current wolf target and parses save action', async () => {
    let state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Villager, Role.Villager, Role.Seer, Role.Witch,
    ] })
    state = submitNightAction(state, { actorId: 1, targetId: 3, actionType: 'kill' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'save:3' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const action = await decideNightAction(buildPlayerContext(6, state), {
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      providers: [{
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: ['deepseek-v4-pro'],
      }],
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.messages[1].content).toContain('今晚狼刀目标：3号')
    expect(action).toEqual({ actorId: 6, targetId: 3, actionType: 'save' })
    fetchMock.mockRestore()
  })

  it('keeps werewolf prompts aware of teammates and forbids targeting them', async () => {
    const state = createInitialState({ playerCount: 12, roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
    ] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '先别刀7，7是狼队友，刀11号。' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await decideWolfDiscussionSpeech(buildPlayerContext(1, state), {
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      providers: [{
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: ['deepseek-v4-pro'],
      }],
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.messages[1].content).toContain('你的狼队友')
    expect(body.messages[1].content).toContain('不要提议击杀狼队友')
    expect(body.messages[0].content).toContain('隐藏推理中完成角色代入')
    expect(body.messages[1].content).toContain('隐藏推理中代入当前身份')
    expect(body.messages[1].content).toContain('最终 content 只能输出角色会在群聊里说出口的台词')
    expect(body.messages[1].content).not.toContain('心想')
    expect(body.messages[1].content).not.toContain('内心独白')
    fetchMock.mockRestore()
  })

  it('strips leaked inner thoughts from final speech', async () => {
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '（心想：我是狼，先保队友。）今天先听发言，不急着归票。' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const speech = await decideDaySpeech(buildPlayerContext(1, state), {
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      providers: [{
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: ['deepseek-v4-pro'],
      }],
    })

    expect(speech).toBe('今天先听发言，不急着归票。')
    fetchMock.mockRestore()
  })


  it('lets post-game prompts freely recap, roast, argue, and discuss for entertainment', async () => {
    const state = createInitialState({ playerCount: 6, roles: [
      Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager,
    ] })
    const postGameState = { ...state, winner: 'werewolf' as const, phase: 'postGameDiscussion' as const }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '???????????????' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await decidePostGameSpeech(buildPlayerContext(1, postGameState), {
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      providers: [{
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'key',
        models: ['deepseek-v4-pro'],
        thinkingEnabled: true,
        reasoningEffort: 'high',
      }],
    })

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    const userContent = body.messages[1].content as string
    expect(userContent).toContain('25')
    expect(userContent).toContain('\u81ea\u7531\u53d1\u6325')
    expect(userContent).toContain('\u5bf9\u55b7')
    expect(userContent).toContain('\u8ba8\u8bba')
    expect(userContent).toContain('\u8d5b\u540e\u89c2\u6218\u723d\u611f')
    fetchMock.mockRestore()
  })

})

