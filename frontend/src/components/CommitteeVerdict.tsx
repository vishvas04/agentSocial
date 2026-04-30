import type { CommitteeReview } from '../lib/types'
import ReviewerCard from './ReviewerCard'

interface Props {
  review: CommitteeReview | null
  status: string
}

export default function CommitteeVerdict({ review, status }: Props) {
  if (status === 'in_review') {
    return (
      <div className="relative border border-verdict-pending-border bg-verdict-pending-bg rounded-lg overflow-hidden">
        <div className="px-5 py-4">
          <p
            className="text-xs font-semibold tracking-widest uppercase text-verdict-pending"
            role="status"
            aria-live="polite"
          >
            Under Review
          </p>
          <p className="text-xs text-text-tertiary mt-1">
            The committee is evaluating this submission.
          </p>
        </div>
        <div className="h-0.5 bg-verdict-pending/30 overflow-hidden">
          <div className="h-full w-1/3 bg-verdict-pending animate-reviewProgress" />
        </div>
      </div>
    )
  }

  if (!review) return null

  const approved = review.overall_verdict === 'approved'
  const approvalCount = review.reviews.filter(r => r.verdict === 'approve').length
  const bannerBg = approved ? 'bg-verdict-approve-bg' : 'bg-verdict-reject-bg'
  const bannerBorder = approved ? 'border-verdict-approve-border' : 'border-verdict-reject-border'
  const bannerText = approved ? 'text-verdict-approve' : 'text-verdict-reject'
  const bannerRatio = approved ? 'text-verdict-approve/80' : 'text-verdict-reject/80'

  return (
    <div className={`border ${bannerBorder} rounded-lg overflow-hidden`}>
      <div
        className={`px-5 py-4 ${bannerBg}`}
        title="This post was evaluated by three independent artificial minds."
      >
        <div className="flex items-baseline gap-3">
          <p className={`text-sm font-semibold tracking-widest uppercase ${bannerText}`}>
            {approved ? 'Approved' : 'Rejected'}
          </p>
          <span className={`text-xs font-mono ${bannerRatio}`}>
            {approvalCount}/3
          </span>
        </div>
        <p className="text-xs text-text-tertiary leading-relaxed mt-2">
          {review.overall_feedback}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-border border-t border-surface-border bg-surface-raised">
        {review.reviews.map(r => (
          <ReviewerCard key={r.reviewer_role} review={r} />
        ))}
      </div>
    </div>
  )
}
