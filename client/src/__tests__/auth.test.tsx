import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { NavBar } from '../components/NavBar'
import { apiFetch } from '../api'

vi.mock('../api', () => ({
  apiFetch: vi.fn(),
}))

const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>

function LoginHarness() {
  const { user, loading, login } = useAuth()
  if (loading) return <div>loading</div>
  return (
    <div>
      <span>{user?.username ?? 'none'}</span>
      <button onClick={() => login('alice', 'secret123')}>go</button>
    </div>
  )
}

beforeEach(() => {
  mockApiFetch.mockReset()
})

describe('AuthContext', () => {
  it('exposes login that calls the API and sets the user', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/auth/login') return Promise.resolve({ id: 2, username: 'alice', role: 'USER' })
      return Promise.reject(new Error('not logged in'))
    })
    render(<AuthProvider><LoginHarness /></AuthProvider>)
    fireEvent.click(await screen.findByText('go'))
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument())
    expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }))
  })
})

describe('NavBar', () => {
  it('renders username and hides Admin link for non-admins', async () => {
    mockApiFetch.mockResolvedValue({ id: 2, username: 'alice', role: 'USER' })
    render(<MemoryRouter><AuthProvider><NavBar /></AuthProvider></MemoryRouter>)
    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })
  it('renders Admin link for admins', async () => {
    mockApiFetch.mockResolvedValue({ id: 1, username: 'admin', role: 'ADMIN' })
    render(<MemoryRouter><AuthProvider><NavBar /></AuthProvider></MemoryRouter>)
    expect(await screen.findByText('admin')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })
})
