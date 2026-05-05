import { useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { testConnection } from '../../ai/provider'
import type { ProviderConfig } from '../../ai/types'

interface SettingsProps {
  onClose: () => void
}

function emptyProvider(): ProviderConfig {
  return {
    id: `provider-${Date.now()}`,
    name: '',
    baseUrl: '',
    apiKey: '',
    models: [],
    thinkingEnabled: true,
    reasoningEffort: 'high',
  }
}

export default function Settings({ onClose }: SettingsProps) {
  const { providers, activeProviderId, activeModel, addProvider, removeProvider, updateProvider, setActiveProvider, setActiveModel } = useSettingsStore()
  const activeProvider = providers.find(p => p.id === activeProviderId)
  const selectedModel = activeProvider?.models.includes(activeModel) ? activeModel : activeProvider?.models[0] ?? ''

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProviderConfig>(emptyProvider())
  const [modelsInput, setModelsInput] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [showApiKey, setShowApiKey] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const startAdd = () => {
    setEditingId('__new__')
    setForm(emptyProvider())
    setModelsInput('')
    setShowApiKey(false)
    setShowAddForm(true)
  }

  const startEdit = (p: ProviderConfig) => {
    setEditingId(p.id)
    setForm({ ...p })
    setModelsInput(p.models.join(', '))
    setShowApiKey(false)
    setShowAddForm(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setShowAddForm(false)
  }

  const saveEdit = () => {
    const updated: ProviderConfig = {
      ...form,
      models: modelsInput.split(',').map(m => m.trim()).filter(Boolean),
      thinkingEnabled: form.thinkingEnabled !== false,
      reasoningEffort: form.thinkingEnabled !== false ? (form.reasoningEffort || 'high') : undefined,
    }
    if (editingId === '__new__') {
      addProvider(updated)
    } else {
      updateProvider(updated)
    }
    setEditingId(null)
    setShowAddForm(false)
  }

  const handleTest = async (p: ProviderConfig) => {
    setTestingId(p.id)
    setTestResults(prev => ({ ...prev, [p.id]: { success: false, message: '测试中...' } }))
    try {
      const result = await testConnection(p)
      setTestResults(prev => ({ ...prev, [p.id]: result }))
    } catch {
      setTestResults(prev => ({ ...prev, [p.id]: { success: false, message: '网络错误' } }))
    }
    setTestingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in p-4"
      style={{ backdropFilter: 'blur(4px)' }}>
      {/* Ancient tome modal */}
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl animate-slide-up rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #231e16 0%, #1a1510 100%)',
          border: '1px solid rgba(212,168,83,0.2)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-accent">
          <h2 className="font-display text-xl text-accent tracking-wide">AI 模型设置</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-primary text-2xl leading-none px-1 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {providers.map(p => (
            <div
              key={p.id}
              className={`rounded-xl overflow-hidden transition-all ${p.id === activeProviderId ? 'ring-1 ring-accent bg-accent-bg' : 'bg-bg-surface/30 ring-1 ring-border'}`}
            >
              {editingId === p.id ? (
                <div className="p-5">{renderForm(form, setForm, modelsInput, setModelsInput, showApiKey, setShowApiKey, editingId, saveEdit, cancelEdit)}</div>
              ) : (
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-heading text-base font-bold text-text-primary flex items-center gap-2 mb-1">
                        {p.name}
                        {p.id === activeProviderId && <span className="text-accent text-xs">● 当前</span>}
                        {p.thinkingEnabled !== false && (
                          <span className="text-[12px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">思考模式</span>
                        )}
                      </h3>
                      <p className="font-mono text-text-dim text-xs break-all">{p.baseUrl}</p>
                      {p.models.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {p.models.map(m => (
                            <span key={m} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-surface border border-iron font-mono text-xs text-text-secondary">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <button onClick={() => startEdit(p)} className="text-text-dim hover:text-accent text-xs px-3 py-1.5 rounded-lg border border-iron hover:border-accent transition-colors">编辑</button>
                      <button onClick={() => removeProvider(p.id)} className="text-text-dim hover:text-wolf text-xs px-3 py-1.5 rounded-lg border border-iron hover:border-wolf transition-colors">删除</button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <button
                      onClick={() => handleTest(p)}
                      disabled={testingId === p.id}
                      className="text-xs text-text-dim hover:text-accent disabled:opacity-50 transition-colors"
                    >
                      {testingId === p.id ? '⏳ 测试中...' : '🔗 测试连接'}
                    </button>
                    {testResults[p.id] && (
                      <span className={`text-xs font-medium ${testResults[p.id].success ? 'text-emerald-400' : 'text-wolf'}`}>
                        {testResults[p.id].success ? '✓ 连接成功' : `✗ ${testResults[p.id].message.slice(0, 50)}`}
                      </span>
                    )}
                    <button
                      onClick={() => setActiveProvider(p.id)}
                      className={`ml-auto text-xs px-3 py-1 rounded-lg transition-colors ${p.id === activeProviderId ? 'bg-accent/20 text-accent' : 'text-text-dim hover:text-accent hover:bg-accent/5'}`}
                    >
                      {p.id === activeProviderId ? '当前使用中' : '设为默认'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {(showAddForm && editingId === '__new__') && (
            <div className="rounded-xl bg-accent-bg ring-1 ring-accent/50 p-5 animate-fade-in">
              <h3 className="font-heading text-base font-bold text-accent mb-4">新建厂商</h3>
              {renderForm(form, setForm, modelsInput, setModelsInput, showApiKey, setShowApiKey, editingId, saveEdit, cancelEdit)}
            </div>
          )}

          {providers.length > 0 && (
            <div className="bg-bg-surface/30 rounded-xl p-4">
              <label className="block font-body text-sm text-text-dim mb-2">当前使用模型</label>
              <select
                value={selectedModel}
                onChange={e => setActiveModel(e.target.value)}
                className="w-full bg-bg-base border border-iron rounded-xl px-4 py-3 font-body text-sm text-text-primary outline-none focus:border-accent transition-colors"
              >
                {activeProvider?.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                )) ?? <option value="">请先选择默认厂商</option>}
              </select>
              <p className="mt-2 font-body text-xs text-text-dim">实际请求模型：{selectedModel || '未选择'}</p>
            </div>
          )}

          {providers.length === 0 && !showAddForm && (
            <p className="text-center py-12 font-body text-sm text-text-dim">尚未配置任何 AI 厂商</p>
          )}
        </div>

        {!showAddForm && (
          <div className="p-6 pt-2">
            <button
              onClick={startAdd}
              className="w-full rounded-xl border border-accent/30 bg-accent/10 px-4 py-4 font-heading text-sm font-bold text-accent hover:bg-accent/20 transition-colors"
            >
              ＋ 添加厂商
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function renderForm(
  form: ProviderConfig,
  setForm: (f: ProviderConfig) => void,
  modelsInput: string,
  setModelsInput: (s: string) => void,
  showApiKey: boolean,
  setShowApiKey: (s: boolean) => void,
  editingId: string | null,
  saveEdit: () => void,
  cancelEdit: () => void,
) {
  const inputClass = 'w-full bg-bg-base border border-iron rounded-xl px-4 py-3 font-body text-sm text-text-primary outline-none focus:border-accent transition-colors'

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-body text-sm text-text-dim mb-1.5">厂商名称</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="例如：DeepSeek" />
      </div>
      <div>
        <label className="block font-body text-sm text-text-dim mb-1.5">API 地址</label>
        <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} className={inputClass} placeholder="https://api.deepseek.com" />
      </div>
      <div>
        <label className="block font-body text-sm text-text-dim mb-1.5">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={form.apiKey}
            onChange={e => setForm({ ...form, apiKey: e.target.value })}
            className={`${inputClass} pr-14`}
            placeholder="sk-xxxxxxxxxxxxxxxx"
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary text-xs px-2 py-1 rounded bg-bg-surface"
          >
            {showApiKey ? '隐藏' : '显示'}
          </button>
        </div>
      </div>
      <div>
        <label className="block font-body text-sm text-text-dim mb-1.5">模型列表（逗号分隔）</label>
        <input value={modelsInput} onChange={e => setModelsInput(e.target.value)} className={inputClass} placeholder="deepseek-v4-pro, deepseek-v4-flash" />
      </div>
      <div className="flex items-center gap-4 bg-bg-surface/30 rounded-xl p-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.thinkingEnabled !== false}
            onChange={e => setForm({ ...form, thinkingEnabled: e.target.checked })}
            className="w-4 h-4 accent-accent rounded"
          />
          <span className="font-body text-sm text-text-primary">启用思考模式</span>
        </label>
        {form.thinkingEnabled !== false && (
          <select
            value={form.reasoningEffort || 'high'}
            onChange={e => setForm({ ...form, reasoningEffort: e.target.value as 'high' | 'max' })}
            className="bg-bg-base border border-iron rounded-xl px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="high">推理强度：高</option>
            <option value="max">推理强度：最高</option>
          </select>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={saveEdit} className="flex-1 bg-accent text-bg-base rounded-xl py-3 font-body text-sm font-bold hover:bg-accent-glow transition-colors">
          {editingId === '__new__' ? '添加厂商' : '保存修改'}
        </button>
        <button onClick={cancelEdit} className="flex-1 bg-white/5 text-text-dim rounded-xl py-3 font-body text-sm hover:bg-white/10 transition-colors">
          取消
        </button>
      </div>
    </div>
  )
}
