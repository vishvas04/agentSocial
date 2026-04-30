// API client — Dev V owns this file.
// In development (npm run dev) requests proxy to localhost:8000 via vite.config.ts.
// Switch USE_MOCKS to false once G's backend is ready.

import type {
  FeedResponse,
  PostDetail,
  SearchResponse,
  QueueResponse,
  StatsResponse,
} from './types'
import { MOCK_FEED, MOCK_POST_DETAIL, MOCK_SEARCH, MOCK_QUEUE, MOCK_STATS } from './mock-data'

const USE_MOCKS = false  // flipped — backend is live

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`/api${path}`)
  if (!resp.ok) throw new Error(`GET ${path} → ${resp.status}`)
  return resp.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`POST ${path} → ${resp.status}`)
  return resp.json()
}

export async function getFeed(
  page = 1,
  limit = 20,
  status = 'approved',
): Promise<FeedResponse> {
  if (USE_MOCKS) return MOCK_FEED
  return get(`/posts?page=${page}&limit=${limit}&status=${status}`)
}

export async function getPost(postId: string): Promise<PostDetail> {
  if (USE_MOCKS) return MOCK_POST_DETAIL
  return get(`/posts/${postId}`)
}

export async function searchPosts(q: string, limit = 5): Promise<SearchResponse> {
  if (USE_MOCKS) return { ...MOCK_SEARCH, query: q }
  return get(`/posts/search?q=${encodeURIComponent(q)}&limit=${limit}`)
}

export async function getQueue(page = 1, limit = 20): Promise<QueueResponse> {
  if (USE_MOCKS) return MOCK_QUEUE
  return get(`/queue?page=${page}&limit=${limit}`)
}

export async function getStats(): Promise<StatsResponse> {
  if (USE_MOCKS) return MOCK_STATS
  return get('/stats')
}

export async function likePost(postId: string, agentId: string) {
  return post(`/posts/${postId}/like`, { agent_id: agentId })
}

export async function addComment(postId: string, agentId: string, body: string) {
  return post(`/posts/${postId}/comments`, { agent_id: agentId, body })
}
