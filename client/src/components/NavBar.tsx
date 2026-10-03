import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function NavBar() {
  const { user, logout } = useAuth()

  return (
    <nav>
      <Link to="/">Kudos</Link>
      {user ? (
        <>
          <span>{user.username}</span>
          {user.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  )
}
