import NumberFlow from '@number-flow/react'

const NUMBER = /(\d[\d,]*(?:\.\d+)?)/

/**
 * Renders formatted text like '5 h 57 min', '2,599 kcal', '04:24' or '48–154 bpm' with every number
 * rolling digit by digit (NumberFlow) when it changes. Text around the numbers stays as is.
 */
export function AnimatedValue({ text }: { text: string }) {
  const parts = text.split(NUMBER)
  return (
    <span className="inline-flex items-baseline">
      {parts.map((part, i) => {
        if (i % 2 === 0) return part ? <span key={i} className="whitespace-pre">{part}</span> : null
        const decimals = part.split('.')[1]?.length ?? 0
        return (
          <NumberFlow
            key={i}
            value={Number(part.replace(/,/g, ''))}
            locales="en-GB"
            format={{
              useGrouping: part.includes(','),
              // Keep clock times like 04:05 two digits wide
              minimumIntegerDigits: part.length === 2 && part.startsWith('0') ? 2 : 1,
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            }}
          />
        )
      })}
    </span>
  )
}
