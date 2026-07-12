import { useEffect, useState } from 'react'
import type { HealthResponseType } from '@reqor/shared-types'

export function App() {
  const [health, setHealth] = useState<HealthResponseType | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
        return res.json()
      })
      .then((data: HealthResponseType) => setHealth(data))
      .catch((err) => {
        console.error('Failed to fetch health:', err)
        setError(true)
      })
  }, [])

  return (
    <main>
      <h1>Reqor</h1>
      {health ? (
        <p>
          API health: {health.status} (v{health.version})
        </p>
      ) : error ? (
        <p>Health check failed</p>
      ) : (
        <p>Loading health...</p>
      )}
    </main>
  )
}
