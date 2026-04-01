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
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '48px 40px',
        width: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="https://hesti-rossmann.de/wp-content/uploads/2026/01/hesti-logo.png"
            alt="Hesti Rossmann"
            style={{ height: 56, objectFit: 'contain' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a', marginTop: 12 }}>HestiOS</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Hesti Rossmann GmbH</div>
        </div>

        {/* Lang switcher */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
          {(['ro','de','en'] as const).map(lng => (
            <button
              key={lng}
              onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('hestios_lang', lng); }}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid',
                borderColor: i18n.language === lng ? '#1d4ed8' : '#e5e7eb',
                background: i18n.language === lng ? '#eff6ff' : '#fff',
                color: i18n.language === lng ? '#1d4ed8' : '#6b7280',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}
            >{lng.toUpperCase()}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {t('auth.email')}
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {t('auth.password')}
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: loading ? '#93c5fd' : '#1d4ed8', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? t('common.loading') : t('auth.loginBtn')}
          </button>
        </form>
      </div>
    </div>
  );
}
