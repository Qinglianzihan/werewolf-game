import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIConfig, ProviderConfig } from '../ai/types'
import { DEFAULT_PROVIDERS } from '../ai/provider'

interface SettingsStore extends AIConfig {
  addProvider: (provider: ProviderConfig) => void
  removeProvider: (id: string) => void
  updateProvider: (provider: ProviderConfig) => void
  setActiveProvider: (id: string) => void
  setActiveModel: (model: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      providers: DEFAULT_PROVIDERS,
      activeProviderId: DEFAULT_PROVIDERS[0]?.id ?? '',
      activeModel: DEFAULT_PROVIDERS[0]?.models[0] ?? '',
      activeModelsByProvider: {},

      addProvider: (provider) =>
        set(state => ({ providers: [...state.providers, provider] })),

      removeProvider: (id) =>
        set(state => ({ providers: state.providers.filter(p => p.id !== id) })),

      updateProvider: (provider) =>
        set(state => ({
          providers: state.providers.map(p => p.id === provider.id ? provider : p),
        })),

      setActiveProvider: (id) => set(state => {
        const provider = state.providers.find(p => p.id === id)
        const remembered = state.activeModelsByProvider?.[id]
        return {
          activeProviderId: id,
          activeModel: remembered && provider?.models.includes(remembered)
            ? remembered
            : provider?.models[0] ?? '',
        }
      }),

      setActiveModel: (model) => set(state => ({
        activeModel: model,
        activeModelsByProvider: { ...(state.activeModelsByProvider ?? {}), [state.activeProviderId]: model },
      })),
    }),
    { name: 'werewolf-settings' },
  ),
)
