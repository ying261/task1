import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { KudosForm } from '../components/KudosForm'
import { KudosFeed } from '../components/KudosFeed'
import { KudosCard } from '../components/KudosCard'
import { apiFetch } from '../api'
import type { KudosDTO } from '../types'

vi.mock('../api', () => ({
  apiFetch: vi.fn(),
}))

const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockApiFetch.mockReset()
})

describe('KudosForm', () => {
  it('renders recipient select from /api/users and submits POST /api/kudos', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/users') return Promise.resolve({ users: [{ id: 2, username: 'bob' }] })
      if (path === '/api/kudos') return Promise.resolve({})
      return Promise.reject(new Error('unexpected path ' + path))
    })
    const onSubmitted = vi.fn()
    render(<KudosForm onSubmitted={onSubmitted} />)
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: '2' } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nice work!' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/kudos', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recipientId: 2, message: 'Nice work!' }),
      }))
    })
    expect(onSubmitted).toHaveBeenCalled()
  })

  it('shows an error and does not submit when message is empty', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/users') return Promise.resolve({ users: [{ id: 2, username: 'bob' }] })
      return Promise.reject(new Error('unexpected path ' + path))
    })
    render(<KudosForm onSubmitted={vi.fn()} />)
    await screen.findByRole('combobox')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText('Message is required')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalledWith('/api/kudos', expect.objectContaining({ method: 'POST' }))
  })
})

describe('KudosFeed', () => {
  it('renders one card per item from GET /api/kudos', async () => {
    mockApiFetch.mockResolvedValue({
      items: [
        { id: 1, message: 'Great job', createdAt: '2026-10-03T00:00:00Z', sender: { id: 1, username: 'alice' }, recipient: { id: 2, username: 'bob' } },
        { id: 2, message: 'Thanks', createdAt: '2026-10-03T00:00:00Z', sender: { id: 2, username: 'bob' }, recipient: { id: 1, username: 'alice' } },
      ],
      page: 1,
      limit: 20,
      total: 2,
    })
    render(<KudosFeed />)
    expect(await screen.findByText('Great job')).toBeInTheDocument()
    expect(screen.getByText('Thanks')).toBeInTheDocument()
  })
})

describe('KudosCard', () => {
  it('renders sender -> recipient and message', () => {
    const kudos: KudosDTO = {
      id: 1,
      message: 'Great job',
      createdAt: '2026-10-03T00:00:00Z',
      sender: { id: 1, username: 'alice' },
      recipient: { id: 2, username: 'bob' },
    }
    render(<KudosCard kudos={kudos} />)
    expect(screen.getByText('alice -> bob')).toBeInTheDocument()
    expect(screen.getByText('Great job')).toBeInTheDocument()
  })
})
