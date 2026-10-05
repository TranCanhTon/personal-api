// How chess.com words a game's end, for the match list.
const WAYS: Record<string, string> = {
  checkmated: 'checkmate',
  resigned: 'resignation',
  timeout: 'timeout',
  abandoned: 'abandonment',
  lose: '',
  stalemate: 'stalemate',
  agreed: 'agreement',
  repetition: 'repetition',
  insufficient: 'insufficient material',
  '50move': '50-move rule',
  timevsinsufficient: 'timeout vs insufficient material',
}

type Ending = { outcome: string; result: string; opponent_result: string }

/** 'Won by checkmate', 'Lost on timeout', 'Draw by stalemate'. For a win the way is how the opponent lost. */
export function endingLabel(g: Ending): { text: string; outcome: 'win' | 'loss' | 'draw' } {
  if (g.outcome === 'win') {
    const way = WAYS[g.opponent_result]
    return { text: way ? `Won by ${way}` : 'Won', outcome: 'win' }
  }
  const way = WAYS[g.result]
  if (g.outcome === 'draw') return { text: way ? `Draw by ${way}` : 'Draw', outcome: 'draw' }
  return { text: way ? `Lost by ${way}` : 'Lost', outcome: 'loss' }
}

/** 'Mar 2025'-style short date for a YYYY-MM-DD string */
export function monthYear(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
