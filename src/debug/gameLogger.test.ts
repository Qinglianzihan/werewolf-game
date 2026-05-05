import { describe, expect, it, vi, beforeEach } from 'vitest'
import { appendApiLog, buildApiLogText, readLogSession, redactRequest, startLogSession } from './gameLogger'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

describe('gameLogger', () => {
  beforeEach(() => {
    if (typeof localStorage === 'undefined') vi.stubGlobal('localStorage', new MemoryStorage())
    if (typeof window === 'undefined') vi.stubGlobal('window', new EventTarget())
    localStorage.clear()
  })

  it('keeps per-game API logs in copyable localStorage text', () => {
    const gameId = startLogSession()

    appendApiLog({
      task: 'vote',
      player: '3号 白芷',
      role: 'witch',
      provider: 'DeepSeek',
      model: 'deepseek-v4-pro',
      url: 'https://api.deepseek.com/chat/completions',
      status: 'error',
      durationMs: 1200,
      error: 'API 400: bad request',
    })

    const session = readLogSession()
    const text = buildApiLogText()
    expect(session.gameId).toBe(gameId)
    expect(session.apiLogs).toHaveLength(1)
    expect(text).toContain('API 400: bad request')
    expect(text).toContain('3号 白芷')
  })

  it('notifies the log panel whenever API logs change', () => {
    const listener = vi.fn()
    window.addEventListener('werewolf-logs-updated', listener)
    startLogSession()

    appendApiLog({ task: 'daySpeech', provider: 'P', model: 'M', status: 'fallback', error: 'empty response' })

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('werewolf-logs-updated', listener)
  })

  it('keeps full request message content without truncating tokens in logs', () => {
    const content = 'x'.repeat(6000)

    const redacted = redactRequest({ messages: [{ role: 'user', content }] })

    expect(((redacted.messages as Array<{ content: string }>)[0].content)).toHaveLength(6000)
    expect(((redacted.messages as Array<{ content: string }>)[0].content)).not.toContain('truncated')
  })

})
