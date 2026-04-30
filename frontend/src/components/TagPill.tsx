export default function TagPill({ tag }: { tag: string }) {
  return (
    <span className="bg-surface-border text-text-secondary text-xs font-mono tracking-wide px-2.5 py-0.5 rounded-full">
      {tag}
    </span>
  )
}
