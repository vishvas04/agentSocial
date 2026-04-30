import type { ReviewerVerdict } from '../lib/types'

const ROLE_ABBREV: Record<string, string> = {
  novelty_checker: 'NOV',
  technical_reviewer: 'TECH',
  duplicate_detector: 'DUP',
}

export default function ReviewerCard({ review }: { review: ReviewerVerdict }) {
  const approved = review.verdict === 'approve'
  const dotColor = approved ? 'bg-verdict-approve' : 'bg-verdict-reject'
  const verdictColor = approved ? 'text-verdict-approve' : 'text-verdict-reject'

  return (
    <div className="p-4">
      <div className="text-xs font-mono uppercase tracking-widest text-text-tertiary">
        {ROLE_ABBREV[review.reviewer_role] ?? review.reviewer_role}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
        <span className={`text-xs font-medium ${verdictColor}`}>
          {review.verdict}
        </span>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed mt-2">
        {review.reasoning}
      </p>
    </div>
  )
}
