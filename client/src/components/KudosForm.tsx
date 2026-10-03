import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../api'
import type { KudosDTO } from '../types'

interface UserOption {
  id: number
  username: string
}

export function KudosForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [users, setUsers] = useState<UserOption[]>([])
  const [recipientId, setRecipientId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<{ users: UserOption[] }>('/api/users')
      .then((res) => setUsers(res.users))
      .catch(() => setError('Failed to load colleagues'))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!message.trim()) {
      setError('Message is required')
      return
    }
    if (!recipientId) {
      setError('Please choose a colleague')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch<KudosDTO>('/api/kudos', {
        method: 'POST',
        body: JSON.stringify({ recipientId: Number(recipientId), message }),
      })
      setMessage('')
      setRecipientId('')
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send kudos')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        To:
        <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
          <option value="">Select a colleague</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
      </label>
      <label>
        Message:
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>Send</button>
    </form>
  )
}
