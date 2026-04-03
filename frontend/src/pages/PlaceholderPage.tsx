import { useTranslation } from 'react-i18next';

export function PlaceholderPage({ pageKey }: { pageKey: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '60px 36px', textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
        {t(`nav.${pageKey}`)}
      </div>
      <div style={{ fontSize: 14 }}>{t('placeholderExtra.underDevelopment')}</div>
    </div>
  );
}
