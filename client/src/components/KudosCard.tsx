import type { KudosDTO } from '../types'

export function KudosCard({ kudos }: { kudos: KudosDTO }) {
  return (
    <div>
      <div>{kudos.sender.username} -&gt; {kudos.recipient.username}</div>
      <p>{kudos.message}</p>
    </div>
  )
}
