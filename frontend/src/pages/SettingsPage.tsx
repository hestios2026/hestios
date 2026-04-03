import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchSettings, saveSettings, fetchDocumentCategories, saveDocumentCategories, DocCategory, fetchConnectionTypes, saveConnectionTypes } from '../api/settings';

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Document Categories Section ──────────────────────────────────────────────

const ICON_OPTIONS = ['📄','🧾','📝','✅','📐','🖼','📊','⚙️','🦺','🏆','✉️','📁','🗂','📋','📌','🔖','💼','🏗','📦','🔧','🔑','📜'];
const COLOR_PRESETS = ['#1d4ed8','#7c3aed','#f97316','#d97706','#0891b2','#16a34a','#dc2626','#6366f1','#ef4444','#0d9488','#64748b','#94a3b8','#e11d48','#0284c7'];

function DocumentCategoriesSection() {
  const { t } = useTranslation();
  const [cats, setCats] = useState<DocCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState({ key: '', label: '', color: '#1d4ed8', icon: '📁' });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchDocumentCategories().then(setCats).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveDocumentCategories(cats);
      toast.success(t('settingsExtra.categoriesSaved'));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || t('common.error'));
    } finally { setSaving(false); }
  }

  function handleAdd() {
    if (!newCat.key.trim() || !newCat.label.trim()) {
      toast.error(t('settingsExtra.keyRequired'));
      return;
    }
    const key = newCat.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (cats.find(c => c.key === key)) {
      toast.error(t('settingsExtra.keyExists'));
      return;
    }
    setCats(p => [...p, { ...newCat, key }]);
    setNewCat({ key: '', label: '', color: '#1d4ed8', icon: '📁' });
  }

  function handleDelete(idx: number) {
    setCats(p => p.filter((_, i) => i !== idx));
  }

  function handleEdit(idx: number, field: keyof DocCategory, val: string) {
    setCats(p => p.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }

  function handleMove(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= cats.length) return;
    const arr = [...cats];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setCats(arr);
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
        {t('settingsExtra.docCategories')}
      </div>

      {/* Existing categories */}
      <div style={{ marginBottom: 16 }}>
        {cats.map((c, idx) => (
          <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {/* Order */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#94a3b8', padding: '0 2px' }}>▲</button>
              <button onClick={() => handleMove(idx, 1)} disabled={idx === cats.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#94a3b8', padding: '0 2px' }}>▼</button>
            </div>
            {/* Icon picker */}
            {editingIdx === idx ? (
              <select value={c.icon} onChange={e => handleEdit(idx, 'icon', e.target.value)}
                style={{ fontSize: 18, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}>
                {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: 20, cursor: 'pointer' }} onClick={() => setEditingIdx(idx)}>{c.icon}</span>
            )}
            {/* Color */}
            <input type="color" value={c.color} onChange={e => handleEdit(idx, 'color', e.target.value)}
              style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer', padding: 1 }} />
            {/* Label */}
            <input value={c.label} onChange={e => handleEdit(idx, 'label', e.target.value)}
              style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
            {/* Key (readonly) */}
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', minWidth: 100, background: '#f1f5f9', padding: '3px 7px', borderRadius: 4 }}>{c.key}</span>
            {/* Preview badge */}
            <span style={{ background: c.color + '22', color: c.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>
              {c.icon} {c.label}
            </span>
            {/* Delete */}
            <button onClick={() => handleDelete(idx)}
              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>🗑</button>
          </div>
        ))}
      </div>

      {/* Add new category */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: '#eff6ff', borderRadius: 8, border: '1px dashed #93c5fd', marginBottom: 14 }}>
        <select value={newCat.icon} onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))}
          style={{ fontSize: 18, border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 4px' }}>
          {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
        </select>
        <input type="color" value={newCat.color} onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))}
          style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer', padding: 1 }} />
        <input placeholder={t('settingsExtra.labelPlaceholder')} value={newCat.label} onChange={e => setNewCat(p => ({ ...p, label: e.target.value }))}
          style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
        <input placeholder={t('settingsExtra.keyPlaceholder')} value={newCat.key} onChange={e => setNewCat(p => ({ ...p, key: e.target.value }))}
          style={{ width: 120, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'monospace' }} />
        <button onClick={handleAdd}
          style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {t('settingsExtra.addCategory')}
        </button>
      </div>

      {/* Color presets */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{t('settingsExtra.quickColors')}</span>
        {COLOR_PRESETS.map(col => (
          <div key={col} onClick={() => setNewCat(p => ({ ...p, color: col }))}
            style={{ width: 18, height: 18, borderRadius: '50%', background: col, cursor: 'pointer', border: newCat.color === col ? '2px solid #1e293b' : '2px solid transparent' }} />
        ))}
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? t('common.saving') : t('settingsExtra.saveCategories')}
      </button>
    </div>
  );
}


function ConnectionTypesSection() {
  const { t } = useTranslation();
  const [types, setTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newVal, setNewVal] = useState('');

  useEffect(() => {
    fetchConnectionTypes().then(setTypes).catch(() => {});
  }, []);

  async function handleSave() {
    if (!types.length) { toast.error(t('settingsExtra.listEmpty')); return; }
    setSaving(true);
    try {
      await saveConnectionTypes(types);
      toast.success(t('settingsExtra.typesSaved'));
    } catch { toast.error(t('common.error')); }
    finally { setSaving(false); }
  }

  function addType() {
    const v = newVal.trim();
    if (!v) return;
    if (types.includes(v)) { toast.error(t('settingsExtra.alreadyExists')); return; }
    setTypes(p => [...p, v]);
    setNewVal('');
  }

  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };
  const inp2: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{t('settingsExtra.connTypes')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {types.map((tp, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input value={tp} onChange={e => setTypes(p => p.map((x, j) => j === i ? e.target.value : x))}
              style={{ ...inp2, flex: 1, maxWidth: 280 }} />
            <button onClick={() => setTypes(p => p.filter((_, j) => j !== i))}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              ✕
            </button>
            <button onClick={() => i > 0 && setTypes(p => { const a = [...p]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; })}
              disabled={i === 0}
              style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}>▲</button>
            <button onClick={() => i < types.length - 1 && setTypes(p => { const a = [...p]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; })}
              disabled={i === types.length - 1}
              style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer', opacity: i === types.length - 1 ? 0.3 : 1 }}>▼</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addType())}
          placeholder={t('settingsExtra.typeNew')} style={{ ...inp2, width: 200 }} />
        <button onClick={addType}
          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {t('settingsExtra.addType')}
        </button>
      </div>
      <button onClick={handleSave} disabled={saving}
        style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? t('common.saving') : t('settingsExtra.saveTypes')}
      </button>
    </div>
  );
}


export function SettingsPage() {
  const { t } = useTranslation();
  const [form, setForm]     = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty]   = useState(false);

  useEffect(() => {
    fetchSettings().then(data => { setForm(data); setLoading(false); }).catch(() => toast.error(t('common.error')));
  }, []);

  const f = (k: string, v: string) => { setForm(p => ({ ...p, [k]: v })); setDirty(true); };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveSettings(form);
      toast.success(t('settings.saved'));
      setDirty(false);
    } catch { toast.error(t('common.error')); }
  }

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>{t('common.loading')}</div>;

  return (
    <div className="page-root" style={{ maxWidth: 780 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('settings.title')}</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t('settings.subtitle')}</div>
        </div>
        {dirty && (
          <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>{t('settings.unsavedChanges')}</span>
        )}
      </div>

      <form onSubmit={handleSave}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

          <Section title={t('settings.sections.company')}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>{t('settings.companyName')}</label>
              <input value={form.company_name || ''} onChange={e => f('company_name', e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>{t('settings.companyAddress')}</label>
              <input value={form.company_address || ''} placeholder={t('common.streetPlaceholder')} onChange={e => f('company_address', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t('settings.companyCity')}</label>
              <input value={form.company_city || ''} onChange={e => f('company_city', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t('settings.companyZip')}</label>
              <input value={form.company_zip || ''} onChange={e => f('company_zip', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t('settings.companyPhone')}</label>
              <input value={form.company_phone || ''} onChange={e => f('company_phone', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t('settings.companyEmail')}</label>
              <input type="email" value={form.company_email || ''} onChange={e => f('company_email', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t('settings.taxNumber')}</label>
              <input value={form.company_steuernr || ''} onChange={e => f('company_steuernr', e.target.value)} style={inp} />
            </div>
          </Section>

          <Section title={t('settings.sections.bank')}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>{t('settings.iban')}</label>
              <input value={form.company_iban || ''} placeholder="DE..." onChange={e => f('company_iban', e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>{t('settings.bank')}</label>
              <input value={form.company_bank || ''} onChange={e => f('company_bank', e.target.value)} style={inp} />
            </div>
          </Section>

          <Section title={t('settings.sections.brtv')}>
            <div style={{ gridColumn: '1/-1', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              {t('settings.lohnNote')}
            </div>
            {[1,2,3,4,5,6].map(lg => (
              <div key={lg}>
                <label style={lbl}>{t('settings.lohnLabel', { lg })}</label>
                <input type="number" step="0.01" min="0"
                  value={form[`tariflohn_lg${lg}`] || ''}
                  onChange={e => f(`tariflohn_lg${lg}`, e.target.value)}
                  style={inp} placeholder="0.00" />
              </div>
            ))}
            <div>
              <label style={lbl}>{t('settings.bauzuschlag')}</label>
              <input type="number" step="0.01" min="0"
                value={form.bauzuschlag_standard || ''}
                onChange={e => f('bauzuschlag_standard', e.target.value)}
                style={inp} placeholder="0.72" />
            </div>
            <div>
              <label style={lbl}>{t('settings.vacationDefault')}</label>
              <input type="number" min="0" max="40"
                value={form.urlaubsanspruch_default || ''}
                onChange={e => f('urlaubsanspruch_default', e.target.value)}
                style={inp} placeholder="30" />
            </div>
          </Section>

          <Section title={t('settings.sections.notifications')}>
            <div>
              <label style={lbl}>{t('settings.notifyTime')}</label>
              <input type="time" value={form.notify_time || '20:00'} onChange={e => f('notify_time', e.target.value)} style={inp} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{t('settings.notifyNote')}</div>
            </div>
            <div>
              <label style={lbl}>{t('settings.notifyChannel')}</label>
              <select value={form.notify_channel || 'email'} onChange={e => f('notify_channel', e.target.value)} style={inp}>
                <option value="email">{t('settings.channelEmail')}</option>
                <option value="whatsapp">{t('settings.channelWhatsapp')}</option>
                <option value="telegram">{t('settings.channelTelegram')}</option>
              </select>
            </div>
            {(form.notify_channel === 'whatsapp' || !form.notify_channel) && (
              <>
                <div>
                  <label style={lbl}>{t('settings.whatsappPhoneId')}</label>
                  <input value={form.whatsapp_phone_id || ''} onChange={e => f('whatsapp_phone_id', e.target.value)} style={inp} placeholder="ex: 123456789" />
                </div>
                <div>
                  <label style={lbl}>{t('settings.whatsappToken')}</label>
                  <input type="password" value={form.whatsapp_token || ''} onChange={e => f('whatsapp_token', e.target.value)} style={inp} placeholder="Bearer token Meta" />
                </div>
              </>
            )}
            {form.notify_channel === 'email' && (
              <>
                <div>
                  <label style={lbl}>{t('settings.smtpHost')}</label>
                  <input value={form.smtp_host || ''} onChange={e => f('smtp_host', e.target.value)} style={inp} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label style={lbl}>{t('settings.smtpPort')}</label>
                  <input value={form.smtp_port || '587'} onChange={e => f('smtp_port', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{t('settings.smtpUser')}</label>
                  <input value={form.smtp_user || ''} onChange={e => f('smtp_user', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{t('settings.smtpPassword')}</label>
                  <input type="password" value={form.smtp_password || ''} onChange={e => f('smtp_password', e.target.value)} style={inp} />
                </div>
              </>
            )}
            {form.notify_channel === 'telegram' && (
              <>
                <div>
                  <label style={lbl}>{t('settings.telegramBotToken')}</label>
                  <input type="password" value={form.telegram_bot_token || ''} onChange={e => f('telegram_bot_token', e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>{t('settings.telegramChatId')}</label>
                  <input value={form.telegram_chat_id || ''} onChange={e => f('telegram_chat_id', e.target.value)} style={inp} placeholder="-100..." />
                </div>
              </>
            )}
          </Section>
        </div>

        {/* Document Categories — outside the form, has its own save button */}
        <DocumentCategoriesSection />

        {/* Connection Types for Programări */}
        <ConnectionTypesSection />

        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button type="submit" style={{
            padding: '10px 28px', borderRadius: 8, border: 'none',
            background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            {t('settings.saveBtn')}
          </button>
          <button type="button" onClick={() => { fetchSettings().then(d => { setForm(d); setDirty(false); }); }} style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db',
            background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b',
          }}>
            {t('settings.resetBtn')}
          </button>
        </div>
      </form>
    </div>
  );
}
