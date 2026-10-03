import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ModerationList } from './ModerationList'

export function AdminPanel() {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading</div>
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />

  return (
    <div>
      <h1>Admin</h1>
      <ModerationList />
    </div>
  )
}
