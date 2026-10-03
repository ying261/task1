import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await register(username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <h1>Register</h1>
      <label className="form-field">
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
      </label>
      <label className="form-field">
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Register</button>
    </form>
  )
}
