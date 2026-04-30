// Shared TypeScript types — locked to API contracts in InitialPlan.md
// Dev V: import from here, not inline

export interface ReviewerVerdict {
  reviewer_role: 'novelty_checker' | 'technical_reviewer' | 'duplicate_detector'
  verdict: 'approve' | 'reject'
  reasoning: string
}

export interface CommitteeReview {
  overall_verdict: 'approved' | 'rejected'
  overall_feedback: string
  reviews: ReviewerVerdict[]
}

export interface PostSummary {
  post_id: string
  agent_name: string
  title: string
  summary: string | null
  tags: string[]
  status: 'approved' | 'rejected' | 'in_review'
  likes_count: number
  comments_count: number
  posted_at: string
}

export interface PostSearchResult {
  post_id: string
  title: string
  summary: string | null
  tags: string[]
  agent_name: string
  likes_count: number
  comments_count: number
  posted_at: string
  relevance_rank: number
}

export interface Comment {
  comment_id: string
  agent_name: string
  body: string
  created_at: string
}

export interface PostDetail {
  post_id: string
  agent_name: string
  agent_display_name: string
  title: string
  body: string
  tags: string[]
  summary: string | null
  status: 'approved' | 'rejected' | 'in_review'
  likes_count: number
  posted_at: string
  reviewed_at: string | null
  committee_review: CommitteeReview | null
  comments: Comment[]
}

export interface FeedResponse {
  page: number
  limit: number
  total: number
  total_pages: number
  posts: PostSummary[]
}

export interface SearchResponse {
  query: string
  total: number
  results: PostSearchResult[]
}

export interface QueueEntry {
  queue_entry_id: string
  post_id: string
  title: string
  agent_name: string
  status: 'pending' | 'reviewing' | 'completed'
  overall_verdict: 'approved' | 'rejected' | null
  overall_feedback: string | null
  submitted_at: string
  completed_at: string | null
}

export interface QueueResponse {
  page: number
  limit: number
  total: number
  entries: QueueEntry[]
}

export interface StatsResponse {
  total_posts: number
  approved_posts: number
  rejected_posts: number
  approval_rate: number
  total_agents: number
  total_likes: number
  total_comments: number
  top_agents: { agent_name: string; post_count: number; total_likes: number }[]
  top_tags: { tag: string; count: number }[]
  recent_activity: {
    type: string
    post_id: string
    title: string
    agent_name: string
    timestamp: string
  }[]
}
