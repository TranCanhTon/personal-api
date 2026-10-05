import { Chess } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useChessPgn, type ChessGame } from '../../api/client'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { endingLabel } from '../../lib/chess'
import { shortDate } from '../../lib/dates'

const STEP_MS = 900
const OUTCOME_COLOR = { win: 'var(--win)', loss: 'var(--loss)', draw: 'var(--ink-2)' }

type Replay = { positions: string[]; moves: { san: string; from: string; to: string }[] }

/** The game's positions: the start, then the position after each move. Null if the moves can't be read. */
function replayOf(pgn: string): Replay | null {
  try {
    const chess = new Chess()
    chess.loadPgn(pgn)
    const moves = chess.history({ verbose: true })
    return {
      positions: [moves[0]?.before ?? new Chess().fen(), ...moves.map((m) => m.after)],
      moves: moves.map((m) => ({ san: m.san, from: m.from, to: m.to })),
    }
  } catch {
    return null
  }
}

const btn =
  'grid h-9 min-w-9 place-items-center rounded-full border border-line px-3 text-sm text-ink-2 transition-colors hover:border-white/20 hover:text-ink disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-2'

/** A pop-up that replays one game on a board. The moves are fetched when it opens. */
export default function GameBoard({ game, onClose }: { game: ChessGame; onClose: () => void }) {
  const { data, isPending, isError } = useChessPgn(game.uuid)
  const replay = useMemo(() => (data ? replayOf(data.pgn) : null), [data])
  const ending = endingLabel(game)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby="game-board-description">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="truncate font-display text-sm font-semibold tracking-tight text-ink">
              vs {game.opponent}
              {game.opponent_rating != null && <span className="font-normal text-ink-2"> ({game.opponent_rating})</span>}
            </DialogTitle>
            <DialogDescription id="game-board-description" className="mt-1 text-xs text-ink-2">
              <span className="font-semibold" style={{ color: OUTCOME_COLOR[ending.outcome] }}>
                {ending.text}
              </span>
              {' · '}you played {game.color} · {game.opening ?? 'Unknown opening'} · {shortDate(game.date)}
            </DialogDescription>
          </div>
          <DialogClose className={btn} aria-label="Close">
            ✕
          </DialogClose>
        </div>

        <div className="mt-4">
          {isPending && <p className="py-24 text-center text-sm text-muted">Loading moves…</p>}
          {(isError || (data && !replay)) && <p className="py-24 text-center text-sm text-muted">Couldn't load the moves for this game.</p>}
          {replay && <Player key={game.uuid} replay={replay} orientation={game.color === 'black' ? 'black' : 'white'} />}
        </div>

        <a href={game.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          View on chess.com
        </a>
      </DialogContent>
    </Dialog>
  )
}

function Player({ replay, orientation: initial }: { replay: Replay; orientation: 'white' | 'black' }) {
  const last = replay.moves.length
  const [ply, setPly] = useState(0) // 0 is the starting position
  const [playing, setPlaying] = useState(false)
  const [orientation, setOrientation] = useState(initial)
  const current = useRef<HTMLButtonElement>(null)

  // Auto-play: one move per tick, stopping at the end
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setPly((p) => {
        if (p >= last - 1) setPlaying(false)
        return Math.min(p + 1, last)
      })
    }, STEP_MS)
    return () => clearInterval(id)
  }, [playing, last])

  // Keep the current move in view in the move list
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' })
  }, [ply])

  const go = (to: number) => {
    setPlaying(false)
    setPly(Math.max(0, Math.min(to, last)))
  }
  const togglePlay = () => {
    if (playing) return setPlaying(false)
    if (ply >= last) setPly(0)
    setPlaying(true)
  }

  // Arrow keys, Home, End and Space work wherever focus is inside the pop-up. It is modal, so these keys are ours while it's open.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keys.current = (e) => {
      const onButton = e.target instanceof HTMLElement && ['BUTTON', 'A'].includes(e.target.tagName)
      const actions: Record<string, () => void> = {
        ArrowLeft: () => go(ply - 1),
        ArrowRight: () => go(ply + 1),
        Home: () => go(0),
        End: () => go(last),
      }
      if (!onButton) actions[' '] = togglePlay // on a button, Space already presses it
      const action = actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const move = ply > 0 ? replay.moves[ply - 1] : null
  const highlight = { backgroundColor: 'rgba(163, 230, 53, 0.35)' }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
      <div>
        <div className="mx-auto w-full max-w-[30rem]">
          <Chessboard
            options={{
              position: replay.positions[ply],
              boardOrientation: orientation,
              allowDragging: false,
              animationDurationInMs: 180,
              lightSquareStyle: { backgroundColor: '#b8c0d4' },
              darkSquareStyle: { backgroundColor: '#4a5270' },
              squareStyles: move ? { [move.from]: highlight, [move.to]: highlight } : {},
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <button type="button" className={btn} onClick={() => go(0)} disabled={ply === 0} aria-label="Start">
            ⏮
          </button>
          <button type="button" className={btn} onClick={() => go(ply - 1)} disabled={ply === 0} aria-label="Previous move">
            ◀
          </button>
          <button type="button" className={`${btn} min-w-20`} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button type="button" className={btn} onClick={() => go(ply + 1)} disabled={ply === last} aria-label="Next move">
            ▶
          </button>
          <button type="button" className={btn} onClick={() => go(last)} disabled={ply === last} aria-label="End">
            ⏭
          </button>
          <button type="button" className={btn} onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} aria-label="Flip board" title="Flip board">
            ⇅
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted tabular-nums">
          Move {Math.ceil(ply / 2)} · {ply} of {last}
        </p>
      </div>

      <MoveList moves={replay.moves} ply={ply} onPick={go} currentRef={current} />
    </div>
  )
}

function MoveList({
  moves,
  ply,
  onPick,
  currentRef,
}: {
  moves: Replay['moves']
  ply: number
  onPick: (ply: number) => void
  currentRef: React.RefObject<HTMLButtonElement | null>
}) {
  const rows = Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => i)
  const cell = (index: number) => {
    const m = moves[index]
    if (!m) return <span />
    const active = ply === index + 1
    return (
      <button
        type="button"
        ref={active ? currentRef : undefined}
        onClick={() => onPick(index + 1)}
        className={`rounded-md px-2 py-1 text-left text-sm tabular-nums transition-colors ${active ? 'bg-white/15 font-semibold text-ink' : 'text-ink-2 hover:bg-white/[0.06] hover:text-ink'}`}
      >
        {m.san}
      </button>
    )
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-white/[0.025] p-2 md:max-h-[30rem]">
      <div className="grid grid-cols-[2rem_1fr_1fr] items-center gap-y-0.5">
        {rows.map((r) => (
          <div key={r} className="contents">
            <span className="text-xs text-muted tabular-nums">{r + 1}.</span>
            {cell(r * 2)}
            {cell(r * 2 + 1)}
          </div>
        ))}
      </div>
    </div>
  )
}
