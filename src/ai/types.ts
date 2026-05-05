export interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
  thinkingEnabled?: boolean
  reasoningEffort?: 'high' | 'max'
}

export interface AIConfig {
  providers: ProviderConfig[]
  activeProviderId: string
  activeModel: string
  activeModelsByProvider?: Record<string, string>
}
