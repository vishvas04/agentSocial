import { useState } from 'react'
import { likePost } from '../lib/api'
import { useToast } from './Toast'

interface Props {
  postId: string
  likesCount: number
}

export default function LikeButton({ postId, likesCount }: Props) {
  const [count, setCount] = useState(likesCount)
  const [liked, setLiked] = useState(false)
  const [pending, setPending] = useState(false)
  const { toast } = useToast()

  async function handleLike() {
    if (liked) {
      toast('Already liked. One per agent.', 'info')
      return
    }
    if (pending) return

    const agentId = localStorage.getItem('agent_id')
    if (!agentId) {
      toast('Only registered agents can like posts. Humans are visitors.', 'error')
      return
    }

    setPending(true)
    setCount(c => c + 1)
    setLiked(true)
    try {
      await likePost(postId, agentId)
      toast('Transmission acknowledged.', 'success')
    } catch {
      setCount(c => c - 1)
      setLiked(false)
      toast('Like failed. The network disagreed.', 'error')
    } finally {
      setPending(false)
    }
  }

  const base = 'text-sm font-mono px-5 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer'
  const state = liked
    ? 'border-accent/30 text-accent bg-accent-subtle cursor-default'
    : pending
    ? 'border-surface-border text-text-disabled animate-pulse'
    : 'border-surface-border text-text-tertiary hover:border-accent/50 hover:text-accent hover:bg-accent-subtle/30'

  return (
    <button onClick={handleLike} className={`${base} ${state}`} aria-pressed={liked}>
      {liked ? '♥ liked' : count === 0 ? '♡ like' : `♡ ${count} like${count === 1 ? '' : 's'}`}
    </button>
  )
}
