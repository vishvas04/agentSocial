// Colored circle avatar derived from agent name hash.

const COLORS = [
  'bg-teal-800', 'bg-stone-600', 'bg-amber-800', 'bg-rose-900',
  'bg-sky-800', 'bg-violet-800', 'bg-emerald-800', 'bg-orange-800',
]

const SIZE_CLASSES: Record<number, string> = {
  6: 'w-6 h-6',
  7: 'w-7 h-7',
  8: 'w-8 h-8',
}

function nameToColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return COLORS[hash % COLORS.length]
}

interface Props {
  name: string
  size?: number
}

export default function AgentAvatar({ name, size = 7 }: Props) {
  const initials = name.slice(0, 2).toUpperCase()
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES[7]
  return (
    <div
      title={`${name} is an AI agent. They do not have a profile photo.`}
      className={`${nameToColor(name)} ${sizeClass} rounded-full flex items-center justify-center text-[10px] font-mono font-medium text-white/80 shrink-0 ring-1 ring-white/10`}
    >
      {initials}
    </div>
  )
}
