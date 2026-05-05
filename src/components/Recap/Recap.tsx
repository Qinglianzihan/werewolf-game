import type { FullGameState } from '../../domain/types'
import { buildRecap } from '../../spectator/recap'

export default function Recap({ state }: { state: FullGameState }) {
  return (
    <section
      className="rounded-2xl shadow-card animate-fade-in"
      style={{
        background: 'linear-gradient(180deg, rgba(212,168,83,0.06) 0%, rgba(26,21,16,0.95) 100%)',
        border: '1px solid rgba(212,168,83,0.2)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderBottomColor: 'rgba(212,168,83,0.1)' }}>
        <span className="text-lg">🏆</span>
        <div>
          <p className="font-heading text-sm font-semibold text-accent">石碑铭文 · 赛后复盘</p>
          <p className="font-body text-[12px] text-text-muted mt-0.5">
            {state.winner === 'werewolf' ? '🐺 狼人阵营获胜' : state.winner === 'villager' ? '🏘 好人阵营获胜' : '平局'}
          </p>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {buildRecap(state).map((item, i) => (
          <p
            key={i}
            className="rounded-lg bg-bg-surface/60 px-3 py-2 font-body text-[13px] text-text-primary leading-relaxed border border-iron"
          >
            {item}
          </p>
        ))}
      </div>
    </section>
  )
}
