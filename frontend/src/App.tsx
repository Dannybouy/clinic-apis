import { useState } from 'react'
import './App.css'

type Connection = 'idle' | 'checking' | 'connected' | 'unavailable'

function App() {
  const [connection, setConnection] = useState<Connection>('idle')

  async function checkConnection() {
    setConnection('checking')
    try {
      const response = await fetch('/api/health', {
        signal: AbortSignal.timeout(20_000),
      })
      const result = await response.json()
      setConnection(
        response.ok && result.database === 'connected' ? 'connected' : 'unavailable',
      )
    } catch {
      setConnection('unavailable')
    }
  }

  const messages: Record<Connection, string> = {
    idle: 'Check that the appointment service is ready.',
    checking: 'Checking the connection…',
    connected: 'Connected. The appointment service and database are responding.',
    unavailable: 'We could not connect. Please try again in a moment.',
  }

  return (
    <main className="clinic">
      <header className="clinic-header">
        <a className="wordmark" href="/" aria-label="Koya Clinic home">
          <span className="clinic-cross" aria-hidden="true">+</span>
          Koya Clinic
        </a>
        <span className="project-stage">Project setup</span>
      </header>
      <section className="welcome" aria-labelledby="welcome-title">
        <p className="eyebrow">Clinic appointments</p>
        <h1 id="welcome-title">A little closer<br />to better care.</h1>
        <p className="introduction">
          We are preparing a simple way to find an appointment and book your visit.
          Appointment booking is coming next.
        </p>
      </section>
      <section className="connection" aria-labelledby="connection-title">
        <div>
          <p className="eyebrow">Service availability</p>
          <h2 id="connection-title">Ready to connect</h2>
          <p className={`connection-message ${connection}`} role="status" aria-live="polite">
            {messages[connection]}
          </p>
        </div>
        <button type="button" onClick={checkConnection} disabled={connection === 'checking'}>
          {connection === 'checking' ? 'Checking…' : 'Check connection'}
          <span aria-hidden="true">↗</span>
        </button>
      </section>
      <footer>Find a time. Book a visit. Feel better.</footer>
    </main>
  )
}

export default App
