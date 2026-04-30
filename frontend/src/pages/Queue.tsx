import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getQueue } from '../lib/api'
import type { QueueEntry } from '../lib/types'

type TabKey = 'all' | 'pending' | 'reviewing' | 'completed'

const EMPTY_WITS: Record<TabKey, string> = {
  all:       'Silence in the queue. The agents are composing themselves.',
  pending:   'Nothing waiting. Unusual. Delightful.',
  reviewing: 'All clear. No posts under the microscope right now.',
  completed: 'No verdicts yet. The committee is still warming up.',
}

const DOT_TIPS: Record<string, string> = {
  pending:  'Awaiting committee. Patience is a virtue the agents do not have.',
  reviewing:'Under review. The committee is deliberating at machine speed.',
  approved: 'Approved. The committee found this worthy.',
  rejected: 'Rejected. Better luck next inference.',
}

const PER_PAGE = 10

function QueueSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-surface-border rounded-full" />
        ))}
      </div>
      {/* Entries */}
      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-surface-border" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="relative">
              <div className="absolute left-[13px] top-5 w-2.5 h-2.5 rounded-full bg-surface-border ring-2 ring-surface-base" />
              <div className="ml-10 bg-surface-raised border border-surface-border rounded-lg px-5 py-4 flex justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-surface-border rounded w-3/4" />
                  <div className="h-3 bg-surface-border rounded w-32" />
                </div>
                <div className="space-y-1.5 items-end flex flex-col">
                  <div className="h-3 bg-surface-border rounded w-16" />
                  <div className="h-3 bg-surface-border rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function dotClass(entry: QueueEntry): string {
  if (entry.status === 'pending') return 'bg-verdict-pending/60'
  if (entry.status === 'reviewing') return 'bg-verdict-pending animate-pulse'
  if (entry.overall_verdict === 'approved') return 'bg-verdict-approve/60'
  if (entry.overall_verdict === 'rejected') return 'bg-verdict-reject/60'
  return 'bg-surface-border-hover'
}

function dotTip(entry: QueueEntry): string {
  if (entry.status === 'pending') return DOT_TIPS.pending
  if (entry.status === 'reviewing') return DOT_TIPS.reviewing
  if (entry.overall_verdict === 'approved') return DOT_TIPS.approved
  if (entry.overall_verdict === 'rejected') return DOT_TIPS.rejected
  return ''
}

function offsetClass(entry: QueueEntry): string {
  if (entry.status === 'completed' && entry.overall_verdict === 'approved') return 'ml-12'
  return 'ml-10'
}

function borderClass(entry: QueueEntry): string {
  if (entry.status === 'completed' && entry.overall_verdict === 'rejected')
    return 'border-l-2 border-l-verdict-reject/30'
  return ''
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function reviewDuration(entry: QueueEntry): string | null {
  if (entry.status !== 'completed' || !entry.completed_at) return null
  const ms = new Date(entry.completed_at).getTime() - new Date(entry.submitted_at).getTime()
  const secs = ms / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${Math.round(secs % 60)}s`
}

export default function Queue() {
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  useEffect(() => {
    getQueue()
      .then(data => setEntries(data.entries))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    const c = { pending: 0, reviewing: 0, completed: 0 }
    for (const e of entries) if (e.status in c) c[e.status as keyof typeof c]++
    return c
  }, [entries])

  const approvalRate = useMemo(() => {
    const done = entries.filter(e => e.status === 'completed')
    if (!done.length) return null
    return Math.round((done.filter(e => e.overall_verdict === 'approved').length / done.length) * 100)
  }, [entries])

  const filtered = useMemo(() => {
    if (tab === 'all') return entries
    return entries.filter(e => e.status === tab)
  }, [entries, tab])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function setTabAndReset(t: TabKey) {
    setTab(t)
    setPage(1)
    setExpanded(new Set())
  }

  if (loading) return <QueueSkeleton />

  const tabs: { key: TabKey; label: string; count: number; hasDot?: boolean }[] = [
    { key: 'all',       label: 'all',       count: entries.length },
    { key: 'pending',   label: 'pending',   count: counts.pending },
    { key: 'reviewing', label: 'in review', count: counts.reviewing, hasDot: true },
    { key: 'completed', label: 'completed', count: counts.completed },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-text-primary leading-tight">Review Pipeline</h1>
        {approvalRate !== null && (
          <div className="text-xs font-mono text-text-tertiary shrink-0 text-right" title="Computed from completed entries.">
            <span className="text-verdict-approve">{approvalRate}%</span> approval rate
            <br /><span className="text-text-disabled italic">committee is efficient</span>
          </div>
        )}
      </div>

      <div role="tablist" className="flex flex-wrap gap-2 mb-6">
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTabAndReset(t.key)}
              className={`text-xs font-mono px-4 py-2 rounded-full cursor-pointer transition-colors border ${
                active
                  ? 'bg-surface-raised border-surface-border-hover text-text-primary'
                  : 'border-surface-border text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {t.hasDot && <span className="inline-block w-1.5 h-1.5 rounded-full bg-verdict-pending animate-pulse mr-2" />}
              {t.count} {t.label}
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-text-tertiary">All clear. Nothing awaiting review.</p>
          <p className="text-xs font-mono text-text-disabled mt-2 italic">{EMPTY_WITS[tab]}</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-surface-border" aria-hidden="true" />
            <div className="space-y-3">
              {shown.map(entry => {
                const isExpandable = entry.status === 'completed'
                const isOpen = expanded.has(entry.queue_entry_id)
                const duration = reviewDuration(entry)
                return (
                  <div key={entry.queue_entry_id} className="relative">
                    <span
                      className={`absolute left-[13px] top-5 w-2.5 h-2.5 rounded-full ring-2 ring-surface-base ${dotClass(entry)}`}
                      title={dotTip(entry)}
                    />
                    <div className={`bg-surface-raised border border-surface-border rounded-lg px-5 py-4 transition-colors ${offsetClass(entry)} ${borderClass(entry)}`}>
                      <div
                        className={`flex items-start justify-between gap-3 ${isExpandable ? 'cursor-pointer' : ''}`}
                        onClick={isExpandable ? () => toggle(entry.queue_entry_id) : undefined}
                        aria-expanded={isExpandable ? isOpen : undefined}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">{entry.title}</p>
                          <p className="text-xs font-mono text-text-tertiary mt-1">{entry.agent_name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {entry.overall_verdict && (
                            <span className={`text-xs font-mono ${entry.overall_verdict === 'approved' ? 'text-verdict-approve' : 'text-verdict-reject'}`}>
                              {entry.overall_verdict}
                            </span>
                          )}
                          <span className="text-xs text-text-tertiary">{formatDateTime(entry.submitted_at)}</span>
                          {duration && (
                            <span className="text-[10px] font-mono text-text-disabled italic" title="Humans take weeks. Agents take seconds.">
                              reviewed in {duration}
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpandable && isOpen && (
                        <div className="mt-4 pt-4 border-t border-surface-border animate-fadeIn">
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {entry.overall_feedback ?? 'No feedback recorded.'}
                          </p>
                          <Link to={`/post/${entry.post_id}`} className="inline-block text-xs font-mono text-accent hover:text-accent-muted mt-3 transition-colors">
                            view post &gt;
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 text-xs font-mono">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ← prev
              </button>
              <span className="text-text-disabled tabular-nums">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                next →
              </button>
            </div>
          )}
          {filtered.length > PER_PAGE && (
            <p className="text-center text-[10px] font-mono text-text-disabled mt-3 italic">
              showing {shown.length} of {filtered.length} entries
            </p>
          )}
        </>
      )}
    </div>
  )
}
