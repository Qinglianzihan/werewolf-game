import { describe, expect, it, vi } from 'vitest'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

describe('settings store model selection', () => {
  it('remembers the selected model for each provider instead of falling back to another model', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', new MemoryStorage())
    const { useSettingsStore } = await import('./settingsStore')

    useSettingsStore.setState({
      providers: [
        { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: 'k', models: ['deepseek-v4-pro', 'deepseek-v4-flash'] },
        { id: 'other', name: 'Other', baseUrl: 'https://example.test', apiKey: 'k', models: ['other-model'] },
      ],
      activeProviderId: 'deepseek',
      activeModel: 'deepseek-v4-pro',
      activeModelsByProvider: {},
    })

    useSettingsStore.getState().setActiveModel('deepseek-v4-flash')
    useSettingsStore.getState().setActiveProvider('other')
    useSettingsStore.getState().setActiveModel('other-model')
    useSettingsStore.getState().setActiveProvider('deepseek')

    expect(useSettingsStore.getState().activeModel).toBe('deepseek-v4-flash')
  })
})
