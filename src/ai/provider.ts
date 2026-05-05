import type { ProviderConfig } from './types'

const STORAGE_KEY = 'werewolf-settings'

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    thinkingEnabled: true,
    reasoningEffort: 'high',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    models: ['gpt-4o', 'gpt-4o-mini'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    models: ['claude-sonnet-4-6', 'claude-opus-4-7'],
  },
]

export function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return [...DEFAULT_PROVIDERS]
}

export function saveProviders(providers: ProviderConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers))
}

export function addProvider(provider: ProviderConfig): void {
  const providers = loadProviders()
  providers.push(provider)
  saveProviders(providers)
}

export function removeProvider(id: string): void {
  const providers = loadProviders().filter(p => p.id !== id)
  saveProviders(providers)
}

export function updateProvider(provider: ProviderConfig): void {
  const providers = loadProviders().map(p => p.id === provider.id ? provider : p)
  saveProviders(providers)
}

export async function testConnection(provider: ProviderConfig): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.models[0] || 'default',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        stream: false,
        ...(isDeepSeek(provider) ? { thinking: { type: provider.thinkingEnabled === false ? 'disabled' : 'enabled' } } : {}),
        ...(provider.thinkingEnabled !== false ? { reasoning_effort: provider.reasoningEffort ?? 'high' } : {}),
      }),
    })

    if (res.ok) return { success: true, message: '连接成功' }
    const body = await res.text().catch(() => '')
    return { success: false, message: `HTTP ${res.status}: ${body}` }
  } catch (e: unknown) {
    return { success: false, message: e instanceof Error ? e.message : '连接失败' }
  }
}

function isDeepSeek(provider: ProviderConfig): boolean {
  return /deepseek/i.test(provider.name) || /api\.deepseek\.com/i.test(provider.baseUrl)
}
