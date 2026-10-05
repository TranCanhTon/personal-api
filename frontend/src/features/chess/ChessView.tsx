import { useMemo, useState } from 'react'
import type { Chess, ChessGame } from '../../api/client'
import { CardTitle, ChartCard } from '../../components/ChartCard'
import { EChart } from '../../components/EChart'
import { Headline } from '../../components/Headline'
import { MagicCard } from '../../components/magicui/magic-card'
import { Readout } from '../../components/Readout'
import { StatTile } from '../../components/StatTile'
import { baseOption, lineStyle } from '../../lib/chartKit'
import { endingLabel, monthYear } from '../../lib/chess'
import { dayMonth, shortDate } from '../../lib/dates'
import { num } from '../../lib/format'
import { useTheme } from '../../lib/theme'

export const PAGE_SIZE = 20

const pct = (v: number | null | undefined) => (v == null ? '—' : `${num(v, 0)}%`)
const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

type Props = {
  chess: Chess
  /** Asks for the next page of games */
  onMore: () => void
  loadingMore: boolean
}

export function ChessView({ chess, onMore, loadingMore }: Props) {
  const { summary: s } = chess
  const none = chess.total_games === 0

  return (
    <div className="space-y-4">
      <Headline label="Rapid rating" accent="var(--chess)" value={s.rating == null ? 'No games' : num(s.rating)} muted={s.rating == null} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Record" accent="var(--chess)" value={`${s.wins} - ${s.losses} - ${s.draws}`} sub="won - lost - drawn" muted={none} />
        <StatTile label="Win rate" accent="var(--chess)" value={pct(s.win_rate)} sub={s.abandoned ? `${s.abandoned} abandoned not counted` : undefined} muted={s.win_rate == null} />
        <StatTile
          label="Best rating"
          accent="var(--chess)"
          value={s.best_rating == null ? '—' : num(s.best_rating)}
          sub={s.best_rating_date ? monthYear(s.best_rating_date) : undefined}
          muted={s.best_rating == null}
        />
        <StatTile label="Games" accent="var(--chess)" value={num(chess.total_games)} muted={none} />
      </div>

      {none ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-muted">No rapid games saved yet</p>
      ) : (
        <>
          <RatingChart chess={chess} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Colours chess={chess} />
            <Openings chess={chess} />
          </div>
          <History chess={chess} onMore={onMore} loadingMore={loadingMore} />
        </>
      )}
    </div>
  )
}

function RatingChart({ chess }: { chess: Chess }) {
  const { tokens: t } = useTheme()
  const [hovered, setHovered] = useState<number | null>(null)
  const points = chess.rating_history

  const option = useMemo(() => {
    // Games can span years, so say which year once they do
    const spansYears = points.length > 0 && points[0].ended_at.slice(0, 4) !== points[points.length - 1].ended_at.slice(0, 4)
    const labels = points.map((p) => {
      const day = p.ended_at.slice(0, 10)
      return spansYears ? `${dayMonth(day)} ${day.slice(2, 4)}` : dayMonth(day)
    })
    return {
      ...baseOption({
        t,
        dates: labels,
        yAxis: {
          min: (v: { min: number }) => Math.floor((v.min - 20) / 50) * 50,
          max: (v: { max: number }) => Math.ceil((v.max + 20) / 50) * 50,
          axisLabel: { color: t.muted },
        },
        hideTooltip: true,
        tooltip: () => '',
      }),
      // One point per game, labelled with its date. The base chart's day-number labels don't fit a long history.
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: t.axis } },
        axisTick: { show: false },
        axisLabel: { color: t.muted, hideOverlap: true },
      },
      series: [{ ...lineStyle(t, t.chess, { area: true }), name: 'Rating', data: points.map((p) => p.rating) }],
    }
  }, [points, t])

  const s = chess.summary
  const at = hovered == null ? null : points[hovered]
  const before = hovered != null && hovered > 0 ? points[hovered - 1].rating : null
  const readout = {
    title: at ? shortDate(at.ended_at.slice(0, 10)) : 'Now',
    items: [
      { label: 'Rating', value: num(at ? at.rating : s.rating) },
      { label: 'Change', value: at ? (before == null ? null : signed(at.rating - before)) : null },
      { label: 'Best', value: num(s.best_rating) },
    ],
  }

  return (
    <ChartCard
      title="Rating"
      accent="var(--chess)"
      footer={<Readout {...readout} />}
      table={{
        head: ['Date', 'Rating'],
        rows: [...points].reverse().map((p, i) => [`${shortDate(p.ended_at.slice(0, 10))} #${points.length - i}`, num(p.rating)]),
      }}
    >
      <EChart option={option} label="Rapid rating after each game" onHover={setHovered} />
    </ChartCard>
  )
}

function Bar({ rate }: { rate: number | null }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--loss) 35%, transparent)' }}>
      <div className="h-full rounded-full" style={{ width: `${rate ?? 0}%`, background: 'var(--win)', boxShadow: '0 0 10px var(--win)' }} />
    </div>
  )
}

function Colours({ chess }: { chess: Chess }) {
  const rows = [
    { name: 'White', dot: '#f4f4f8', r: chess.white },
    { name: 'Black', dot: '#0b0b10', r: chess.black },
  ]
  return (
    <MagicCard color="var(--chess)">
      <section className="p-5">
        <CardTitle title="White vs black" accent="var(--chess)" />
        <ul className="mt-4 space-y-4">
          {rows.map(({ name, dot, r }) => (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <span className="size-3 rounded-full border border-white/30" style={{ background: dot }} />
                  {name}
                </span>
                <span className="text-xs text-ink-2 tabular-nums">
                  {r.wins}-{r.losses}-{r.draws} · {pct(r.win_rate)}
                </span>
              </div>
              <Bar rate={r.win_rate ?? null} />
            </li>
          ))}
        </ul>
      </section>
    </MagicCard>
  )
}

function Openings({ chess }: { chess: Chess }) {
  return (
    <MagicCard color="var(--chess)">
      <section className="p-5">
        <CardTitle title="Openings" accent="var(--chess)" />
        <ul className="mt-4 space-y-3">
          {chess.openings.map((o) => (
            <li key={o.opening}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-ink">{o.opening}</span>
                <span className="shrink-0 text-xs text-ink-2 tabular-nums">
                  {o.games} {o.games === 1 ? 'game' : 'games'} · {pct(o.win_rate)}
                </span>
              </div>
              <Bar rate={o.win_rate ?? null} />
            </li>
          ))}
        </ul>
      </section>
    </MagicCard>
  )
}

function History({ chess, onMore, loadingMore }: Props) {
  const { games, total_games: total } = chess

  return (
    <MagicCard color="var(--chess)">
      <section className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle title="Game history" accent="var(--chess)" />
          <span className="text-xs text-ink-2 tabular-nums">{total}</span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {games.map((g) => (
            <GameRow key={g.uuid} game={g} />
          ))}
        </ul>
        {games.length < total && (
          <button
            type="button"
            onClick={onMore}
            disabled={loadingMore}
            className="mt-3 w-full rounded-full border border-line py-1.5 text-xs text-ink-2 transition-colors hover:border-white/20 hover:text-ink disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : `Show more (${total - games.length} left)`}
          </button>
        )}
      </section>
    </MagicCard>
  )
}

const OUTCOME_COLOR = { win: 'var(--win)', loss: 'var(--loss)', draw: 'var(--ink-2)' }

function GameRow({ game: g }: { game: ChessGame }) {
  const ending = endingLabel(g)
  const color = OUTCOME_COLOR[ending.outcome]
  const time = new Date(g.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  return (
    <li>
      <a
        href={g.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.025] py-2.5 pr-3 pl-3 transition-colors hover:border-white/15"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <span
          className="size-3.5 shrink-0 rounded-full border border-white/30"
          style={{ background: g.color === 'white' ? '#f4f4f8' : '#0b0b10' }}
          title={`Played ${g.color}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink">
              {g.opponent}
              {g.opponent_rating != null && <span className="font-normal text-ink-2"> ({g.opponent_rating})</span>}
            </span>
            <span className="shrink-0 text-xs font-semibold" style={{ color }}>
              {ending.text}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-ink-2">
            <span className="truncate">
              {g.opening ?? 'Unknown opening'}
              {g.abandoned ? ' · abandoned' : ''}
            </span>
            <span className="shrink-0 tabular-nums">
              {shortDate(g.date)} · {time}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right whitespace-nowrap">
          <div className="text-sm font-semibold text-ink tabular-nums">{g.rating}</div>
          <div className="text-xs tabular-nums" style={{ color: g.rating_change == null ? 'var(--muted)' : g.rating_change >= 0 ? 'var(--win)' : 'var(--loss)' }}>
            {g.rating_change == null ? '—' : signed(g.rating_change)}
          </div>
        </div>
      </a>
    </li>
  )
}
