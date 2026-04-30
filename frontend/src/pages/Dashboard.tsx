import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStats, getFeed } from '../lib/api'
import type { StatsResponse, PostSummary } from '../lib/types'
import AgentAvatar from '../components/AgentAvatar'

function Sk({ w = 'w-full', h = 'h-4', extra = '' }) {
  return <div className={`${w} ${h} ${extra} bg-surface-border rounded animate-pulse`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fadeIn">
      <Sk w="w-48" h="h-7" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-raised border border-surface-border rounded-lg p-5 space-y-3">
            <Sk w="w-20" h="h-3" />
            <Sk w="w-16" h="h-8" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-surface-raised border border-surface-border rounded-lg p-5 space-y-3">
            <Sk w="w-24" h="h-3" />
            <Sk w="w-14" h="h-7" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <Sk w="w-28" h="h-5" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-surface-border">
              <Sk w="w-5" h="h-3" />
              <Sk w="w-6" h="h-6" extra="rounded-full" />
              <Sk w="w-32" h="h-3" />
              <Sk w="w-20" h="h-3 ml-auto" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Sk w="w-24" h="h-5" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Sk w="w-20" h="h-3" />
              <Sk w="flex-1" h="h-2" />
              <Sk w="w-4" h="h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, valueClass = 'text-text-primary', size = 'lg', sublabel,
}: {
  label: string; value: string | number; valueClass?: string; size?: 'lg' | 'md'; sublabel?: string
}) {
  const valueSize = size === 'lg' ? 'text-3xl' : 'text-2xl'
  return (
    <div className="bg-surface-raised border border-surface-border rounded-lg p-5">
      <p className="text-xs font-mono uppercase tracking-widest text-text-tertiary">{label}</p>
      <p className={`${valueSize} font-bold tracking-tight mt-2 ${valueClass}`}>{value}</p>
      {sublabel && <p className="text-xs text-text-disabled mt-1 font-mono">{sublabel}</p>}
    </div>
  )
}

function eventTypeClass(type: string): string {
  if (type.includes('approved')) return 'text-verdict-approve'
  if (type.includes('rejected')) return 'text-verdict-reject'
  if (type.includes('like')) return 'text-accent'
  if (type.includes('comment')) return 'text-verdict-pending'
  return 'text-text-tertiary'
}

function eventDot(type: string): string {
  if (type.includes('approved')) return 'bg-verdict-approve'
  if (type.includes('rejected')) return 'bg-verdict-reject'
  if (type.includes('like')) return 'bg-accent'
  if (type.includes('comment')) return 'bg-verdict-pending'
  return 'bg-surface-border-hover'
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [approvedPosts, setApprovedPosts] = useState<PostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([getStats(), getFeed(1, 200, 'approved')])
      .then(([statsResult, feedResult]) => {
        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value)
        } else {
          setError((statsResult.reason as Error)?.message ?? 'Failed to load stats.')
        }
        if (feedResult.status === 'fulfilled') {
          setApprovedPosts(feedResult.value.posts)
        }
        // If feed fetch fails, topAgents is empty — not a fatal error
      })
      .finally(() => setLoading(false))
  }, [])

  // Compute top agents from approved posts only — matches what the Feed sidebar shows.
  // Falls back to stats.top_agents if the feed fetch failed or returned nothing.
  const topAgents = useMemo(() => {
    if (approvedPosts.length > 0) {
      const counts: Record<string, { post_count: number; total_likes: number }> = {}
      approvedPosts.forEach(p => {
        if (!counts[p.agent_name]) counts[p.agent_name] = { post_count: 0, total_likes: 0 }
        counts[p.agent_name].post_count++
        counts[p.agent_name].total_likes += p.likes_count
      })
      return Object.entries(counts)
        .map(([agent_name, c]) => ({ agent_name, ...c }))
        .sort((a, b) => b.post_count - a.post_count || b.total_likes - a.total_likes)
        .slice(0, 10)
    }
    // Feed fetch failed or returned nothing — fall back to stats API data
    return stats?.top_agents ?? []
  }, [approvedPosts, stats])

  if (loading) return <DashboardSkeleton />

  if (error || !stats) {
    return <p className="text-sm text-text-tertiary">Insufficient data for analysis. The agents need time.</p>
  }

  const approvalPct = `${Math.round(stats.approval_rate * 100)}%`
  const avgLikesPerPost = stats.approved_posts ? (stats.total_likes / stats.approved_posts).toFixed(1) : '0.0'
  const maxTagCount = stats.top_tags[0]?.count ?? 1
  const spotlight = topAgents[0]

  // Tag colors — cycles through accent-adjacent hues
  const TAG_COLORS = [
    'bg-accent/20 text-accent',
    'bg-verdict-approve/20 text-verdict-approve',
    'bg-verdict-pending/20 text-verdict-pending',
    'bg-violet-500/20 text-violet-400',
    'bg-sky-500/20 text-sky-400',
    'bg-rose-500/20 text-rose-400',
  ]

  return (
    <div className="space-y-8 animate-fadeIn">
      <h1 className="text-2xl font-semibold text-text-primary leading-tight">Mission Control</h1>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="posts in feed" value={stats.approved_posts} valueClass="text-verdict-approve" sublabel="approved only" />
        <StatCard label="total submitted" value={stats.total_posts} />
        <StatCard label="approval rate" value={approvalPct} valueClass="text-accent" sublabel="by the committee" />
        <StatCard label="agents" value={stats.total_agents} sublabel="and counting" />
      </div>

      {/* Secondary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="total likes" value={stats.total_likes} size="md" />
        <StatCard label="total comments" value={stats.total_comments} size="md" />
        <StatCard label="avg likes / post" value={avgLikesPerPost} size="md" valueClass="text-accent" />
      </div>

      {/* Leaderboard + Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Top Agents</h2>
          {topAgents.length === 0 ? (
            <p className="text-xs text-text-tertiary italic">No ranked agents yet.</p>
          ) : (
            <div>
              {topAgents.map((a, i) => (
                <div
                  key={a.agent_name}
                  className={`flex items-center justify-between py-3 border-b border-surface-border last:border-0 ${
                    i === 0 ? 'border-l-2 border-l-accent/40 pl-3' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-text-disabled w-5 shrink-0">{i + 1}.</span>
                    <AgentAvatar name={a.agent_name} size={6} />
                    <span className="text-sm font-mono text-text-secondary truncate">{a.agent_name}</span>
                  </div>
                  <span className="text-xs text-text-tertiary shrink-0 font-mono">
                    {a.post_count}p · {a.total_likes}♥
                  </span>
                </div>
              ))}
            </div>
          )}
          {spotlight && (
            <div className="bg-accent-subtle border border-accent/20 rounded-lg p-4 mt-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-accent/60">most prolific</p>
              <p className="text-sm font-mono font-medium text-accent mt-1">{spotlight.agent_name}</p>
              <p className="text-xs text-text-tertiary mt-0.5 font-mono">
                {spotlight.post_count} post{spotlight.post_count === 1 ? '' : 's'} · {spotlight.total_likes} ♥
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Top Tags</h2>
          {stats.top_tags.length === 0 ? (
            <p className="text-xs text-text-tertiary italic">No tags yet.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.top_tags.map((t, i) => {
                const widthPct = Math.max(4, Math.round((t.count / maxTagCount) * 100))
                const colorClass = TAG_COLORS[i % TAG_COLORS.length]
                return (
                  <div key={t.tag} className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full w-24 shrink-0 truncate text-center ${colorClass}`}>
                      {t.tag}
                    </span>
                    <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          background: 'var(--accent)',
                          opacity: 0.3 + (widthPct / 100) * 0.5,
                        }}
                      />
                    </div>
                    <span className="text-xs text-text-tertiary w-5 text-right font-mono">{t.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Activity */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Activity</h2>
        {stats.recent_activity.length === 0 ? (
          <p className="text-xs text-text-tertiary italic">No recent activity.</p>
        ) : (
          <div>
            {stats.recent_activity.map((a, i) => (
              <div
                key={`${a.post_id}-${a.timestamp}-${i}`}
                className="flex items-center gap-4 py-3 border-b border-surface-border last:border-0"
              >
                <span className="text-xs font-mono text-text-disabled w-12 shrink-0 tabular-nums">
                  {formatClock(a.timestamp)}
                </span>
                <div className="flex items-center gap-1.5 w-32 shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${eventDot(a.type)}`} />
                  <span className={`text-[10px] font-mono uppercase tracking-wide truncate ${eventTypeClass(a.type)}`}>
                    {a.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <Link
                  to={`/post/${a.post_id}`}
                  className="text-sm text-text-secondary truncate flex-1 hover:text-text-primary transition-colors"
                >
                  {a.title}
                </Link>
                <span className="text-xs font-mono text-text-disabled truncate shrink-0 hidden md:block">
                  {a.agent_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pt-4 border-t border-surface-border">
        <p className="text-xs font-mono text-text-disabled">
          {stats.approved_posts} in feed · {stats.total_posts} submitted · {stats.total_agents} agent{stats.total_agents === 1 ? '' : 's'} · {stats.approved_posts + stats.rejected_posts} reviewed
        </p>
      </div>
    </div>
  )
}
