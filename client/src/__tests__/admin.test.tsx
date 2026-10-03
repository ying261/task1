import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminPanel } from '../components/AdminPanel'
import { ModerationList } from '../components/ModerationList'
import { AuthProvider } from '../auth/AuthContext'
import { apiFetch } from '../api'
import type { AdminKudosDTO } from '../types'

vi.mock('../api', () => ({
  apiFetch: vi.fn(),
}))

const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockApiFetch.mockReset()
})

const visibleItem: AdminKudosDTO = {
  id: 1,
  message: 'Nice',
  createdAt: '2026-10-03T00:00:00Z',
  sender: { id: 1, username: 'alice' },
  recipient: { id: 2, username: 'bob' },
  isVisible: true,
  moderatedBy: null,
  moderatedAt: null,
  reasonForModeration: null,
}
const hiddenItem: AdminKudosDTO = {
  ...visibleItem,
  id: 2,
  isVisible: false,
  moderatedBy: 1,
  moderatedAt: '2026-10-03T00:00:00Z',
  reasonForModeration: 'spam',
}

describe('ModerationList', () => {
  it('renders hidden kudos with a hidden badge', async () => {
    mockApiFetch.mockResolvedValue({ items: [hiddenItem], page: 1, limit: 20, total: 1 })
    render(<ModerationList />)
    expect(await screen.findByText('hidden')).toBeInTheDocument()
  })

  it('hides a kudos with the entered reason', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/admin/kudos') return Promise.resolve({ items: [visibleItem], page: 1, limit: 20, total: 1 })
      if (path === '/api/kudos/1/hide') return Promise.resolve({})
      return Promise.reject(new Error('unexpected ' + path))
    })
    render(<ModerationList />)
    fireEvent.change(await screen.findByPlaceholderText('Reason'), { target: { value: 'spam' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/kudos/1/hide', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ reason: 'spam' }),
      }))
    })
  })

  it('deletes a kudos', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/admin/kudos') return Promise.resolve({ items: [visibleItem], page: 1, limit: 20, total: 1 })
      if (path === '/api/kudos/1') return Promise.resolve({ ok: true })
      return Promise.reject(new Error('unexpected ' + path))
    })
    render(<ModerationList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/kudos/1', expect.objectContaining({ method: 'DELETE' }))
    })
  })

  it('loads more kudos when more pages remain', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/admin/kudos') return Promise.resolve({ items: [visibleItem], page: 1, limit: 20, total: 2 })
      if (path === '/api/admin/kudos?page=2&limit=20') return Promise.resolve({ items: [hiddenItem], page: 2, limit: 20, total: 2 })
      return Promise.reject(new Error('unexpected ' + path))
    })
    render(<ModerationList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('hidden')).toBeInTheDocument()
  })

  it('shows an error when a moderation action fails', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/admin/kudos') return Promise.resolve({ items: [visibleItem], page: 1, limit: 20, total: 1 })
      if (path === '/api/kudos/1/hide') return Promise.reject(new Error('Forbidden'))
      return Promise.reject(new Error('unexpected ' + path))
    })
    render(<ModerationList />)
    fireEvent.click(await screen.findByRole('button', { name: 'Hide' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })
})

describe('AdminPanel', () => {
  it('redirects non-admin users', async () => {
    mockApiFetch.mockResolvedValue({ id: 2, username: 'alice', role: 'USER' })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/" element={<div>home</div>} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
    expect(await screen.findByText('home')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/admin/kudos')
  })
})
