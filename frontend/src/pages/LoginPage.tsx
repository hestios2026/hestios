import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { login } from '../api/auth';
import type { User } from '../types';

interface Props {
  onLogin: (accessToken: string, refreshToken: string, user: User) => void;
}

/** Inline SVG of the H-mark logo (same proportions as the generated PNG) */
function HMark({ size = 40 }: { size?: number }) {
  const sw = Math.round(size * 0.175);  // stroke width
  const cb = Math.round(size * 0.12);   // crossbar height
  const cy = size / 2 - Math.round(size * 0.03);
  const pad = Math.round(size * 0.21);
  const innerW = size - pad * 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} rx={size * 0.20} fill="#0F172A" />
      {/* Left vertical */}
      <rect x={pad} y={pad} width={sw} height={innerW} fill="white" />
      {/* Right vertical */}
      <rect x={size - pad - sw} y={pad} width={sw} height={innerW} fill="white" />
      {/* Green crossbar */}
      <rect x={pad} y={cy - cb / 2} width={size - pad * 2} height={cb} fill="#22C55E" />
    </svg>
  );
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

      {/* Background grid */}
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
        width: 440, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        padding: '52px 48px',
        position: 'relative',
        justifyContent: 'space-between',
      }}>

        {/* Top: Logo block */}
        <div>
          {/* Logo mark + wordmark */}
          <div style={{ marginBottom: 52 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
              <HMark size={52} />
              <div>
                <div style={{
                  color: '#E8EDF5', fontWeight: 800, fontSize: 20,
                  letterSpacing: '0.12em', lineHeight: 1, textTransform: 'uppercase',
                }}>Hesti Rossmann</div>
                <div style={{
                  color: 'rgba(255,255,255,0.25)', fontSize: 10.5,
                  fontWeight: 600, marginTop: 4,
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                }}>GmbH &nbsp;·&nbsp; Kirchheim u. T.</div>
              </div>
            </div>
            <div style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: '#22C55E',
                boxShadow: '0 0 8px rgba(34,197,94,0.8)',
              }} />
              <span style={{
                color: 'rgba(255,255,255,0.2)', fontSize: 10,
                fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
              }}>HestiOS Management System</span>
            </div>
          </div>

          {/* Stats preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { label: 'Șantiere active', value: '—', color: '#22C55E' },
              { label: 'Utilaje urmărite', value: '—', color: '#3B82F6' },
              { label: 'Angajați activi',  value: '—', color: '#8B5CF6' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 0',
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
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

        {/* Bottom: Industries */}
        <div>
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20,
          }}>
            {['Tiefbau', 'Glasfasernetze', 'FTTH', 'FTTB'].map(tag => (
              <span key={tag} style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.22)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4, padding: '3px 8px',
                textTransform: 'uppercase',
              }}>{tag}</span>
            ))}
          </div>
          <div style={{
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

          {/* Mobile logo — shown only on small screens */}
          <div className="hide-tablet" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, marginBottom: 36,
          }}>
            <HMark size={64} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                color: '#E8EDF5', fontWeight: 800, fontSize: 16,
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>Hesti Rossmann</div>
              <div style={{
                color: 'rgba(255,255,255,0.25)', fontSize: 10,
                fontWeight: 600, marginTop: 3,
                letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>HestiOS Management System</div>
            </div>
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
