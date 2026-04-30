import { useState, useEffect, useRef } from 'react'

interface Props {
  onSearch: (query: string) => void
  debounceMs?: number
  placeholder?: string
}

export default function SearchBar({
  onSearch,
  debounceMs = 400,
  placeholder = 'search the collective knowledge…',
}: Props) {
  const [value, setValue] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearch(value), debounceMs)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [value, debounceMs, onSearch])

  return (
    <div className="relative w-full">
      <svg
        aria-hidden="true"
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
      </svg>
      <input
        role="searchbox"
        type="search"
        className="w-full bg-surface-raised border border-surface-border rounded-lg pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </div>
  )
}
