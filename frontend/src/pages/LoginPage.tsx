import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { login } from '../api/auth';
import type { User } from '../types';

interface Props {
  onLogin: (accessToken: string, refreshToken: string, user: User) => void;
}

export function LoginPage({ onLogin }: Props) {
  const { t, i18n } = useTranslation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      onLogin(data.access_token, data.refresh_token, data.user);
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070B11',
      display: 'flex',
      fontFamily: 'var(--font-body)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
      }} />

      {/* Glow orbs */}
      <div style={{
        position: 'absolute', bottom: -200, left: -100,
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: -100, right: -100,
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* ── Left brand panel ── */}
      <div className="hide-mobile" style={{
        width: 420, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        padding: '52px 48px',
        position: 'relative',
        justifyContent: 'space-between',
      }}>

        {/* Top: Logo */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: '#22C55E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(34,197,94,0.35)',
              flexShrink: 0,
            }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>
              </svg>
            </div>
            <div>
              <div style={{
                color: '#E8EDF5', fontWeight: 800, fontSize: 18,
                letterSpacing: '-0.03em', lineHeight: 1,
              }}>HestiOS</div>
              <div style={{
                color: 'rgba(255,255,255,0.2)', fontSize: 10,
                fontWeight: 500, marginTop: 3,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>Management System</div>
            </div>
          </div>

          {/* Stats preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { label: 'Șantiere active', value: '—', color: '#22C55E' },
              { label: 'Utilaje urmărite', value: '—', color: '#3B82F6' },
              { label: 'Angajați activi', value: '—', color: '#8B5CF6' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 800, color: item.color,
                  fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em',
                }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Company info */}
        <div>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.15)',
            lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>
              Hesti Rossmann GmbH
            </div>
            Kirchheim unter Teck<br />
            Tiefbau · Glasfasernetze<br />
            FTTH / FTTB
          </div>
          <div style={{
            marginTop: 20,
            fontSize: 10, color: 'rgba(255,255,255,0.08)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em',
          }}>
            HESTIÖS v1.0 · ALLE RECHTE VORBEHALTEN
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile logo */}
          <div className="hide-tablet" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 36, justifyContent: 'center',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: '#22C55E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(34,197,94,0.3)',
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>
              </svg>
            </div>
            <span style={{ color: '#E8EDF5', fontWeight: 800, fontSize: 17, letterSpacing: '-0.025em' }}>HestiOS</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontSize: 24, fontWeight: 800, color: '#E8EDF5',
              margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1,
            }}>
              Bun venit
            </h1>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 400 }}>
              Autentifică-te pentru a continua
            </p>
          </div>

          {/* Language switcher */}
          <div style={{
            display: 'flex', gap: 2, marginBottom: 24,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8, padding: 3,
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            {(['ro','de','en'] as const).map(lng => (
              <button
                key={lng}
                onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('hestios_lang', lng); }}
                style={{
                  flex: 1, padding: '6.5px 0', borderRadius: 5, border: 'none',
                  background: i18n.language === lng ? '#22C55E' : 'transparent',
                  color: i18n.language === lng ? '#fff' : 'rgba(255,255,255,0.28)',
                  fontWeight: 700, fontSize: 11, cursor: 'pointer',
                  transition: 'all 150ms ease',
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.06em',
                }}
              >{lng.toUpperCase()}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,0.3)', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.09em',
              }}>
                {t('auth.email')}
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
                placeholder="name@hesti-rossmann.de"
                style={{
                  width: '100%', padding: '10px 13px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: '#E8EDF5',
                  fontSize: 13.5, outline: 'none', boxSizing: 'border-box' as const,
                  fontFamily: 'var(--font-body)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(34,197,94,0.5)';
                  e.target.style.background = 'rgba(34,197,94,0.04)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.target.style.background = 'rgba(255,255,255,0.04)';
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,0.3)', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.09em',
              }}>
                {t('auth.password')}
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 13px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: '#E8EDF5',
                  fontSize: 13.5, outline: 'none', boxSizing: 'border-box' as const,
                  fontFamily: 'var(--font-body)',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(34,197,94,0.5)';
                  e.target.style.background = 'rgba(34,197,94,0.04)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.target.style.background = 'rgba(255,255,255,0.04)';
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 7, padding: '9px 13px', color: '#FCA5A5',
                fontSize: 12.5, marginBottom: 14, lineHeight: 1.5,
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                background: loading ? '#15803D' : '#22C55E',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                transition: 'all 150ms ease',
                fontFamily: 'var(--font-body)',
                letterSpacing: '-0.01em',
                boxShadow: loading ? 'none' : '0 0 20px rgba(34,197,94,0.25)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#16A34A'; e.currentTarget.style.boxShadow = '0 0 28px rgba(34,197,94,0.35)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = '#22C55E'; e.currentTarget.style.boxShadow = '0 0 20px rgba(34,197,94,0.25)'; } }}
            >
              {loading ? t('common.loading') : t('auth.loginBtn')}
            </button>
          </form>

          <div style={{
            marginTop: 28, fontSize: 11, color: 'rgba(255,255,255,0.1)',
            textAlign: 'center', fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}>
            HESTIÖS · HESTI ROSSMANN GMBH
          </div>
        </div>
      </div>
    </div>
  );
}
