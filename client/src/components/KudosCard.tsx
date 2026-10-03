import type { KudosDTO } from '../types'

export function KudosCard({ kudos }: { kudos: KudosDTO }) {
  return (
    <div className="card">
      <div className="kudos-header">{kudos.sender.username} -&gt; {kudos.recipient.username}</div>
      <p className="kudos-message">{kudos.message}</p>
    </div>
  )
}
