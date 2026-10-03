import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import type { AdminKudosDTO } from '../types'

interface AdminFeed {
  items: AdminKudosDTO[]
  page: number
  limit: number
  total: number
}

export function ModerationList() {
  const [items, setItems] = useState<AdminKudosDTO[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const res = await apiFetch<AdminFeed>('/api/admin/kudos')
      setItems(res.items)
      setTotal(res.total)
      setPage(1)
      setError('')
    } catch {
      setError('Failed to load kudos')
    }
  }

  async function loadMore() {
    const next = page + 1
    setLoading(true)
    try {
      const res = await apiFetch<AdminFeed>(`/api/admin/kudos?page=${next}&limit=20`)
      setItems((prev) => [...prev, ...res.items])
      setPage(next)
      setTotal(res.total)
    } catch {
      setError('Failed to load more')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function hide(id: number) {
    try {
      await apiFetch(`/api/kudos/${id}/hide`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reasons[id] ?? '' }),
      })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to hide kudos')
    }
  }

  async function unhide(id: number) {
    try {
      await apiFetch(`/api/kudos/${id}/unhide`, { method: 'PATCH' })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unhide kudos')
    }
  }

  async function remove(id: number) {
    try {
      await apiFetch(`/api/kudos/${id}`, { method: 'DELETE' })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete kudos')
    }
  }

  const hasMore = items.length < total

  return (
    <div>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="feed">
        {items.map((k) => (
          <li className="card" key={k.id}>
            <div className="kudos-header">
              {k.sender.username} -&gt; {k.recipient.username}
              {!k.isVisible && <span className="badge">hidden</span>}
            </div>
            <p className="kudos-message">{k.message}</p>
            <div className="actions">
              <input
                placeholder="Reason"
                value={reasons[k.id] ?? ''}
                onChange={(e) => setReasons({ ...reasons, [k.id]: e.target.value })}
              />
              {k.isVisible ? (
                <button onClick={() => hide(k.id)}>Hide</button>
              ) : (
                <button onClick={() => unhide(k.id)}>Unhide</button>
              )}
              <button className="btn-danger" onClick={() => remove(k.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {hasMore && <button onClick={loadMore} disabled={loading}>Load more</button>}
    </div>
  )
}
