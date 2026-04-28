import React, { useState } from 'react'

const C = {
  bg: '#0C0F16',
  card: '#141D2E',
  border: '#1E293B',
  green: '#22C55E',
  text: '#E2E8F0',
  muted: '#64748B',
  inp: '#0F172A',
}

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [serverUrl, setServerUrl] = useState('https://erp.hesti-rossmann.de')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await window.api.auth.login(serverUrl.trim(), email.trim(), password)
      if (res.ok) {
        // Start sync if folder is already set
        await window.api.sync.start()
        onLogin(res.user)
      } else {
        setError(res.error ?? 'Autentificare eșuată')
      }
    } catch (err: any) {
      setError(err.message ?? 'Eroare conexiune')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: C.inp, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, fontSize: 14,
    outline: 'none', transition: 'border-color 0.15s',
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 24 }}>
      {/* Drag region */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 32, WebkitAppRegion: 'drag' } as any} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: C.green, borderRadius: 16, marginBottom: 16 }}>
          <span style={{ color: '#0C0F16', fontWeight: 800, fontSize: 24, letterSpacing: -1 }}>H</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>HestiDMS</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Document Management Desktop</div>
      </div>

      {/* Card */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 380, background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Server URL</label>
          <input style={inp} value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://erp.hesti-rossmann.de" required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
          <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@hesti-rossmann.de" required autoFocus />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Parolă</label>
          <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>

        {error && (
          <div style={{ background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FCA5A5', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '11px 0', background: loading ? '#15803D' : C.green,
          color: '#0C0F16', border: 'none', borderRadius: 8, fontWeight: 700,
          fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
        }}>
          {loading ? 'Se conectează...' : 'Conectare'}
        </button>
      </form>

      <div style={{ marginTop: 20, fontSize: 12, color: C.muted }}>
        Hesti Rossmann GmbH · v1.0.0
      </div>
    </div>
  )
}
