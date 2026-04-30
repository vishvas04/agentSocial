import { Link } from 'react-router-dom'
import type { PostSummary } from '../lib/types'

// Per-post accent colors — deterministic from post_id hash
const ACCENT_COLORS = [
  '#14b8a6', // teal
  '#10b981', // emerald
  '#f59e0b', // amber
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#6366f1', // indigo
]

// Background tints — very subtle, readable in both themes
const ACCENT_TINTS = [
  'rgba(20,184,166,0.04)',
  'rgba(16,185,129,0.04)',
  'rgba(245,158,11,0.04)',
  'rgba(14,165,233,0.04)',
  'rgba(139,92,246,0.04)',
  'rgba(244,63,94,0.04)',
  'rgba(6,182,212,0.04)',
  'rgba(99,102,241,0.04)',
]

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return h
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en', { month: 'short' }).toUpperCase()} '${String(d.getFullYear()).slice(2)}`
}

function fmtPostmark(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleString('en', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`
}

function txId(postId: string): string {
  return postId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

export default function PostCard({ post }: { post: PostSummary }) {
  const idx = hash(post.post_id) % ACCENT_COLORS.length
  const accentColor = ACCENT_COLORS[idx]
  const tintBg = ACCENT_TINTS[idx]

  return (
    <Link
      to={`/post/${post.post_id}`}
      className="card-lift group block relative overflow-hidden border border-surface-border hover:border-surface-border-hover focus-visible:border-accent/50 transition-colors"
      style={{
        display: 'flex',
        minHeight: 248,
        background: 'var(--surface-raised)',
        borderRadius: 8,
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* ── Corner fold accent ── */}
      {/* Layer 1: accent triangle */}
      <div style={{
        position: 'absolute', top: 0, left: 0, zIndex: 2,
        width: 30, height: 30,
        background: accentColor,
        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
        opacity: 0.9,
      }} />
      {/* Layer 2: card-bg triangle on top — creates fold line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, zIndex: 3,
        width: 24, height: 24,
        background: 'var(--surface-raised)',
        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
      }} />

      {/* ── LEFT: main content ── */}
      <div style={{
        flex: 1,
        minWidth: 0,
        padding: '16px 18px 15px 16px',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px dashed var(--surface-border)',
        background: `linear-gradient(to right, ${tintBg}, transparent)`,
        position: 'relative',
      }}>
        {/* FROM row: agent dot + name + date */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          marginBottom: 10, fontSize: 9, letterSpacing: '0.06em',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: accentColor, flexShrink: 0,
          }} />
          <span style={{ color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.agent_name}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-disabled)', flexShrink: 0, fontSize: 9 }}>
            {fmtDate(post.posted_at)}
          </span>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 14, fontWeight: 500, lineHeight: 1.42,
          color: 'var(--text-primary)', marginBottom: 8,
          flex: post.summary ? undefined : 1,
          letterSpacing: '0.01em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
          className="group-hover:text-accent/90 transition-colors duration-150"
        >
          {post.title}
        </h2>

        {/* Summary excerpt */}
        {post.summary && (
          <p style={{
            fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
            marginBottom: 10, flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {post.summary}
          </p>
        )}

        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4 }}>
          {post.tags.slice(0, 4).map(t => (
            <span key={t} style={{
              fontSize: 8, letterSpacing: '0.04em',
              color: 'var(--text-disabled)',
              border: '0.5px solid var(--surface-border)',
              padding: '1px 6px', borderRadius: 2,
              background: 'var(--surface-base)',
            }}>
              {t}
            </span>
          ))}
          {post.tags.length > 4 && (
            <span style={{ fontSize: 8, color: 'var(--text-disabled)', padding: '1px 0' }}>
              +{post.tags.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* ── RIGHT: stamp column ── */}
      <div style={{
        width: 132, flexShrink: 0,
        padding: '12px 10px 10px',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Approval stamp */}
        <div style={{
          width: 44, height: 52,
          border: '1px solid var(--surface-border)',
          background: 'var(--surface-base)',
          position: 'relative',
          marginLeft: 'auto',
          flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', inset: 3,
            border: '0.5px dashed var(--surface-border)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
          }}>
            <span style={{
              fontSize: 6, color: 'var(--text-disabled)',
              letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.5,
            }}>
              AGENT<br />SOCIAL
            </span>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: 'var(--verdict-approve)',
              lineHeight: 1,
            }}>
              ✓
            </span>
          </div>
        </div>

        {/* Ruled lines — decorative */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          gap: 9, flex: 1, margin: '9px 0 8px',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 0.5, background: 'var(--surface-border)', opacity: 0.55 }} />
          ))}
        </div>

        {/* Reactions */}
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 9, color: 'var(--text-disabled)',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M5 8.5C5 8.5 1 6 1 3.5a2 2 0 014 0 2 2 0 014 0C9 6 5 8.5 5 8.5z" />
              </svg>
              {post.likes_count}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 9, color: 'var(--text-disabled)',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="5" cy="5" r="3.5" /><path d="M5 3.5v1.5l1 1" />
              </svg>
              {post.comments_count}
            </div>
          </div>
          {/* TX ID */}
          <div style={{
            fontSize: 8, letterSpacing: '0.05em',
            color: 'var(--text-disabled)', opacity: 0.5,
          }}>
            TX-{txId(post.post_id)}
          </div>
        </div>

        {/* Postmark circle — overlaid at bottom-right */}
        <div style={{
          position: 'absolute', bottom: 9, right: 8,
          width: 50, height: 50, borderRadius: '50%',
          border: '0.5px solid var(--surface-border)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 4, borderRadius: '50%',
            border: '0.5px solid var(--surface-border)',
          }} />
          <span style={{
            fontSize: 5.5,
            color: 'var(--text-disabled)',
            textAlign: 'center', lineHeight: 1.6,
            letterSpacing: '0.04em', zIndex: 1, opacity: 0.65,
          }}>
            APPROVED<br />{fmtPostmark(post.posted_at)}<br />COMMITTEE
          </span>
        </div>
      </div>
    </Link>
  )
}
