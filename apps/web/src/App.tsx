import { useEffect, useState } from 'react'
import { API_URL, APP_NAME } from './config'
import { checkApiHealth, type ApiStatus } from './lib/api'

function App() {
  const [status, setStatus] = useState<ApiStatus | 'checking'>('checking')

  useEffect(() => {
    checkApiHealth().then(setStatus)
  }, [])

  return (
    <main className="container">
      <h1>{APP_NAME}</h1>
      <p className="muted">Painel do gestor da auto escola</p>

      <section className="card">
        <h2>Conexão com a API</h2>
        <dl>
          <dt>URL</dt>
          <dd><code>{API_URL}</code></dd>
          <dt>Status</dt>
          <dd>
            <span className={`badge ${status}`}>
              {status === 'checking' ? 'verificando…' : status === 'online' ? 'online' : 'offline'}
            </span>
          </dd>
        </dl>
        <button type="button" onClick={() => { setStatus('checking'); checkApiHealth().then(setStatus) }}>
          Testar novamente
        </button>
      </section>
    </main>
  )
}

export default App
