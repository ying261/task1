import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import type { KudosDTO } from '../types'
import { KudosCard } from './KudosCard'

interface FeedResponse {
  items: KudosDTO[]
  page: number
  limit: number
  total: number
}

export function KudosFeed() {
  const [items, setItems] = useState<KudosDTO[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    apiFetch<FeedResponse>('/api/kudos')
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
        setPage(1)
      })
      .catch(() => setError('Failed to load the feed'))
      .finally(() => setLoading(false))
  }, [])

  async function loadMore() {
    const next = page + 1
    setLoading(true)
    try {
      const res = await apiFetch<FeedResponse>(`/api/kudos?page=${next}&limit=20`)
      setItems((prev) => [...prev, ...res.items])
      setPage(next)
      setTotal(res.total)
    } catch {
      setError('Failed to load more')
    } finally {
      setLoading(false)
    }
  }

  const hasMore = items.length < total

  return (
    <div>
      {error && <p className="error">{error}</p>}
      <div className="feed">
        {items.map((k) => <KudosCard key={k.id} kudos={k} />)}
      </div>
      {hasMore && <button onClick={loadMore} disabled={loading}>Load more</button>}
    </div>
  )
}
