import { useEffect, useMemo, useState } from 'react'
import type { FullGameState } from '../../domain/types'
import { buildApiLogText, buildReplayText, copyText, downloadText, readLogSession } from '../../debug/gameLogger'

export default function LogPanel({ state }: { state: FullGameState }) {
  const [tick, setTick] = useState(0)
  const [copied, setCopied] = useState('')
  const replayText = useMemo(() => buildReplayText(state), [state])
  void tick
  const session = readLogSession()
  const apiText = buildApiLogText()

  useEffect(() => {
    const onUpdate = () => setTick(x => x + 1)
    window.addEventListener('werewolf-logs-updated', onUpdate)
    return () => window.removeEventListener('werewolf-logs-updated', onUpdate)
  }, [])

  const copy = async (kind: 'api' | 'replay') => {
    await copyText(kind === 'api' ? apiText : replayText)
    setCopied(kind)
    setTimeout(() => setCopied(''), 1200)
  }

  return (
    <section className="rounded-2xl surface-wood shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <p className="font-heading text-sm font-semibold text-text-primary">📖 编年史</p>
          <p className="font-body text-[12px] text-text-muted mt-0.5">
            {session.gameId} · API {session.apiLogs.length} 条
          </p>
        </div>
        <span className="rounded-md bg-text-muted/10 px-2 py-0.5 text-[11px] font-bold text-text-muted">
          LOG
        </span>
      </div>

      <div className="p-3 space-y-2">
        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => copy('api')}
            className="rounded-lg border border-iron bg-bg-elevated/50 px-2.5 py-1.5 font-body text-[12px] font-medium
              text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            {copied === 'api' ? '✓ 已复制API' : '复制 API 日志'}
          </button>
          <button
            onClick={() => copy('replay')}
            className="rounded-lg border border-iron bg-bg-elevated/50 px-2.5 py-1.5 font-body text-[12px] font-medium
              text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            {copied === 'replay' ? '✓ 已复制回放' : '复制对局回放'}
          </button>
          <button
            onClick={() => downloadText(`${session.gameId}-api-log.json`, apiText)}
            className="rounded-lg bg-accent/10 px-2.5 py-1.5 font-body text-[12px] font-medium text-accent
              hover:bg-accent/20 transition-colors"
          >
            下载 API JSON
          </button>
          <button
            onClick={() => downloadText(`${session.gameId}-replay.txt`, replayText)}
            className="rounded-lg bg-accent/10 px-2.5 py-1.5 font-body text-[12px] font-medium text-accent
              hover:bg-accent/20 transition-colors"
          >
            下载回放 TXT
          </button>
        </div>

        {/* Recent API logs */}
        <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg bg-bg-surface/60 p-2.5 border border-iron">
          {session.apiLogs.slice(-8).map(log => (
            <p key={log.id} className="font-mono text-[12px] text-text-muted leading-relaxed">
              [{log.status}] {log.task} {log.player ?? ''} · {log.model} · {log.durationMs ?? 0}ms
              {log.error ? ` · ${log.error}` : ''}
            </p>
          ))}
          {!session.apiLogs.length && (
            <p className="font-body text-[12px] text-text-muted italic">暂无 API 日志。对局开始后实时记录。</p>
          )}
        </div>
      </div>
    </section>
  )
}
