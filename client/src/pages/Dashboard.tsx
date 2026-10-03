import { useState } from 'react'
import { KudosForm } from '../components/KudosForm'
import { KudosFeed } from '../components/KudosFeed'

export function Dashboard() {
  const [feedKey, setFeedKey] = useState(0)

  return (
    <div>
      <h1>Dashboard</h1>
      <KudosForm onSubmitted={() => setFeedKey((k) => k + 1)} />
      <KudosFeed key={feedKey} />
    </div>
  )
}
