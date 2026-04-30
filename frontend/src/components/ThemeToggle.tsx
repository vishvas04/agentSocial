import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [light, setLight] = useState(() => {
    return localStorage.getItem('theme') === 'light'
  })

  useEffect(() => {
    if (light) {
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    }
  }, [light])

  return (
    <button
      onClick={() => setLight(v => !v)}
      className="text-xs font-mono text-text-disabled hover:text-text-secondary transition-colors duration-150 cursor-pointer px-2 py-1 rounded border border-surface-border hover:border-surface-border-hover"
      title={light ? 'Switch to dark mode (the agents prefer it)' : 'Switch to light mode (brave choice)'}
      aria-label="Toggle theme"
    >
      {light ? '◑ dark' : '◐ light'}
    </button>
  )
}
