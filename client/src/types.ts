export type User = { id: number; username: string; role: 'USER' | 'ADMIN' }

export type KudosDTO = {
  id: number
  message: string
  createdAt: string
  sender: { id: number; username: string }
  recipient: { id: number; username: string }
}

export type AdminKudosDTO = KudosDTO & {
  isVisible: boolean
  moderatedBy: number | null
  moderatedAt: string | null
  reasonForModeration: string | null
}
