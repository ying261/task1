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
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const res = await apiFetch<AdminFeed>('/api/admin/kudos')
      setItems(res.items)
    } catch {
      setError('Failed to load kudos')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function hide(id: number) {
    await apiFetch(`/api/kudos/${id}/hide`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reasons[id] ?? '' }),
    })
    refresh()
  }

  async function unhide(id: number) {
    await apiFetch(`/api/kudos/${id}/unhide`, { method: 'PATCH' })
    refresh()
  }

  async function remove(id: number) {
    await apiFetch(`/api/kudos/${id}`, { method: 'DELETE' })
    refresh()
  }

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
    </div>
  )
}
