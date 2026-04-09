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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.09)',
    background: '#1C2A3D', color: '#E2E8F0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Figtree', system-ui, sans-serif",
    transition: 'border-color 180ms ease',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B1120',
      display: 'flex',
      fontFamily: "'Figtree', system-ui, sans-serif",
    }}>

      {/* ── Left brand panel (desktop only) ── */}
      <div className="hide-mobile" style={{
        width: 400, flexShrink: 0,
        background: '#0E1729',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        padding: '48px 44px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative radial glows */}
        <div style={{
          position: 'absolute', bottom: -100, right: -100,
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,93,4,0.11) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 80, left: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(26,86,219,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Horizontal accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 44, right: 44,
          height: 2, background: 'linear-gradient(90deg, #22C55E 0%, transparent 100%)',
        }} />

        {/* Logo */}
        <div style={{ zIndex: 1, marginBottom: 'auto' }}>
          <img
            src="https://hesti-rossmann.de/wp-content/uploads/2026/01/hesti-logo.png"
            alt="Hesti Rossmann"
            style={{ height: 40, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Bottom copy */}
        <div style={{ zIndex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            color: '#22C55E', textTransform: 'uppercase', marginBottom: 16,
          }}>
            Management System
          </div>
          <div style={{
            fontSize: 30, fontWeight: 800, color: '#F1F5F9',
            lineHeight: 1.25, marginBottom: 16,
          }}>
            Hesti Rossmann<br />
            <span style={{ color: '#22C55E' }}>GmbH</span>
          </div>
          <div style={{ fontSize: 13, color: '#4B5A6E', lineHeight: 1.7 }}>
            Kirchheim unter Teck<br />
            Tiefbau · Glasfasernetze<br />
            FTTH / FTTB
          </div>

          <div style={{
            marginTop: 40, paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11, color: '#2C3A4E',
          }}>
            HestiOS v1.0 · Alle Rechte vorbehalten
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile logo (shown only on mobile) */}
          <div className="hide-tablet" style={{ textAlign: 'center', marginBottom: 32 }}>
            <img
              src="https://hesti-rossmann.de/wp-content/uploads/2026/01/hesti-logo.png"
              alt="Hesti Rossmann"
              style={{ height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F1F5F9', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Bun venit
            </div>
            <div style={{ fontSize: 14, color: '#4B5A6E' }}>
              Autentifică-te pentru a continua
            </div>
          </div>

          {/* Language switcher */}
          <div style={{
            display: 'flex', gap: 3, marginBottom: 28,
            background: '#141D2E', borderRadius: 9, padding: 3,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {(['ro','de','en'] as const).map(lng => (
              <button
                key={lng}
                onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('hestios_lang', lng); }}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
                  background: i18n.language === lng ? '#22C55E' : 'transparent',
                  color: i18n.language === lng ? '#fff' : '#4B5A6E',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  transition: 'background 180ms ease, color 180ms ease',
                  fontFamily: "'Figtree', system-ui, sans-serif",
                  letterSpacing: '0.04em',
                }}
              >{lng.toUpperCase()}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: '#8B9AB3', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                {t('auth.email')}
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#22C55E'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                placeholder="name@hesti-rossmann.de"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: '#8B9AB3', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                {t('auth.password')}
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#22C55E'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(180,35,24,0.12)', border: '1px solid rgba(180,35,24,0.25)',
                borderRadius: 8, padding: '10px 14px', color: '#FDA29B',
                fontSize: 13, marginBottom: 16,
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 8, border: 'none',
                background: loading ? '#15803D' : '#22C55E',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                transition: 'background 180ms ease',
                fontFamily: "'Figtree', system-ui, sans-serif",
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#16A34A'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#22C55E'; }}
            >
              {loading ? t('common.loading') : t('auth.loginBtn')}
            </button>
          </form>

          <div style={{ marginTop: 28, fontSize: 12, color: '#2C3A4E', textAlign: 'center' }}>
            HestiOS · Hesti Rossmann GmbH
          </div>
        </div>
      </div>
    </div>
  );
}
