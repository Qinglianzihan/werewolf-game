import type { FullGameState } from '../../domain/types'
import { buildSpectatorEventLog } from '../../spectator/eventLog'
import { buildHighlights } from '../../spectator/highlights'

export default function GodPanel({ state }: { state: FullGameState }) {
  const highlights = buildHighlights(state)
  const eventLog = buildSpectatorEventLog(state)

  return (
    <section className="rounded-2xl shadow-card" style={{
      background: 'linear-gradient(180deg, rgba(26,21,16,0.9) 0%, rgba(20,16,12,0.95) 100%)',
      border: '1px solid rgba(168,85,247,0.15)',
    }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderBottomColor: 'rgba(168,85,247,0.1)' }}>
        <div>
          <p className="font-heading text-sm font-semibold text-seer">🔮 先知水晶球</p>
          <p className="font-body text-[12px] text-text-muted mt-0.5">行动 · 查验 · 事件 · 仅上帝视角</p>
        </div>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-bold text-seer" style={{ background: 'rgba(168,85,247,0.1)' }}>
          GOD VIEW
        </span>
      </div>

      <div className="p-3 space-y-4">
        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="space-y-1.5">
            {highlights.map((item, i) => (
              <p
                key={i}
                className="rounded-lg px-3 py-2 font-body text-[12px] text-text-primary animate-fade-in"
                style={{
                  background: 'rgba(168,85,247,0.06)',
                  border: '1px solid rgba(168,85,247,0.08)',
                }}
              >
                ✦ {item}
              </p>
            ))}
          </div>
        )}

        {/* Night Actions */}
        <div>
          <p className="mb-2 font-body text-[12px] font-semibold uppercase tracking-wider text-text-muted">
            🌑 夜间行动
          </p>
          <div className="space-y-1.5">
            {state.nightActions.length === 0 && (
              <p className="font-body text-xs text-text-muted italic py-2">暂无待结算行动</p>
            )}
            {state.nightActions.map((action, i) => (
              <div
                key={`${action.actorId}-${i}`}
                className="rounded-lg bg-bg-surface/60 px-3 py-2 border border-iron animate-fade-in"
              >
                <p className="font-body text-[12px] text-text-primary">
                  <span className="font-semibold">{action.actorId}号</span>
                  {' '}{actionTypeLabel(action.actionType)}{' '}
                  <span className="font-semibold">{action.targetId}号</span>
                </p>
                <p className="mt-0.5 font-body text-[11px] text-text-dim">
                  {actionBubble(action.actionType)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Seer Checks */}
        <div>
          <p className="mb-2 font-body text-[12px] font-semibold uppercase tracking-wider text-text-muted">
            👁 预言家查验
          </p>
          <div className="space-y-1.5">
            {Object.entries(state.seerChecks).flatMap(([seerId, checks]) =>
              checks.map(check => (
                <p
                  key={`${seerId}-${check.round}-${check.targetId}`}
                  className="rounded-lg bg-bg-surface/60 px-3 py-2 font-body text-[12px] text-text-primary border border-iron"
                >
                  {seerId}号查验 {check.targetId}号：
                  <span className={check.alignment === 'werewolf' ? 'text-wolf font-semibold' : 'text-emerald-400 font-semibold'}>
                    {check.alignment === 'werewolf' ? '狼人' : '好人'}
                  </span>
                </p>
              )),
            )}
            {Object.values(state.seerChecks).flat().length === 0 && (
              <p className="font-body text-xs text-text-muted italic py-2">暂无查验记录</p>
            )}
          </div>
        </div>

        {/* Event Stream */}
        <div>
          <p className="mb-2 font-body text-[12px] font-semibold uppercase tracking-wider text-text-muted">
            📜 事件编年
          </p>
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {eventLog.slice(-24).map((event, i) => (
              <p key={`${event}-${i}`} className="font-body text-[12px] text-text-dim leading-relaxed pl-2 border-l border-border/50">
                {event}
              </p>
            ))}
            {eventLog.length === 0 && (
              <p className="font-body text-xs text-text-muted italic">事件尚待展开...</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function actionTypeLabel(actionType: string): string {
  const labels: Record<string, string> = { kill: '击杀', check: '查验', save: '解救', poison: '毒杀', guard: '守护' }
  return labels[actionType] || actionType
}

function actionBubble(actionType: string): string {
  if (actionType === 'kill') return '狼队夜聊后统一刀口'
  if (actionType === 'check') return '预言家选择一名玩家确认阵营'
  if (actionType === 'save') return '女巫得知刀口后选择使用解药'
  if (actionType === 'poison') return '女巫选择主动使用毒药改变死亡链'
  if (actionType === 'guard') return '守卫预判刀口并选择守护目标'
  return '关键行动已记录'
}
