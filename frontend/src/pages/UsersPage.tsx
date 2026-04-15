import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { fetchUsers, createUser, updateUser, deleteUser, assignSites } from '../api/users';
import { fetchSites } from '../api/sites';
import type { Site } from '../types';

interface AppUser {
  id: number;
  email: string | null;
  username: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  language: string;
  whatsapp_number: string | null;
  notify_whatsapp: boolean;
  current_site_id: number | null;
  mobile_pin: string | null;
  permissions: Record<string, boolean>;
  assigned_site_ids: number[];
}

const ROLE_COLORS: Record<string, [string, string]> = {
  director:       ['#ede9fe', '#7c3aed'],
  projekt_leiter: ['#dbeafe', '#22C55E'],
  polier:         ['#d1fae5', '#059669'],
  sef_santier:    ['#fef3c7', '#d97706'],
  callcenter:     ['#fce7f3', '#be185d'],
  aufmass:        ['#f0fdf4', '#16a34a'],
};

const LANGS = [{ value: 'ro', label: 'Română' }, { value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }];

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };

// Roles that don't need email — use username + PIN instead
const REPORTING_ROLES = ['polier', 'sef_santier', 'aufmass'];

const EMPTY_FORM = { full_name: '', email: '', username: '', password: '', role: 'sef_santier', language: 'ro', mobile_pin: '' };

// Module key → default roles that have access
const MODULE_ROLES: Record<string, string[]> = {
  dashboard:    ['director','projekt_leiter','polier','sef_santier','callcenter','aufmass'],
  sites:        ['director','projekt_leiter','polier','sef_santier','aufmass'],
  equipment:    ['director','projekt_leiter','sef_santier'],
  procurement:  ['director','projekt_leiter','sef_santier'],
  hausanschluss:['director','callcenter'],
  tagesbericht: ['director','projekt_leiter','polier','sef_santier'],
  pontaj:       ['director','projekt_leiter','polier','sef_santier'],
  aufmass:      ['director','projekt_leiter','polier','sef_santier','aufmass'],
  lv:           ['director','projekt_leiter','aufmass'],
  billing:      ['director','projekt_leiter','aufmass'],
  'invoice-scan':['director','projekt_leiter'],
  bauzeitenplan:['director','projekt_leiter','aufmass'],
  hr:           ['director'],
  documents:    ['director','projekt_leiter','callcenter'],
  reports:      ['director','projekt_leiter','polier','sef_santier'],
  users:        ['director'],
  settings:     ['director'],
};

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers]       = useState<AppUser[]>([]);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ full_name: '', role: '', language: '', password: '', whatsapp_number: '', notify_whatsapp: false, mobile_pin: '' });
  const [showPass, setShowPass] = useState(false);
  const [permEdits, setPermEdits] = useState<Record<string, boolean> | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [siteEdits, setSiteEdits] = useState<number[] | null>(null);
  const [savingSites, setSavingSites] = useState(false);

  const ROLE_KEYS = ['director','projekt_leiter','polier','sef_santier','callcenter','aufmass'] as const;
  type RoleKey = typeof ROLE_KEYS[number];

  const getRoleLabel = (role: string) => t(`users.roles.${role}` as any, role);
  const getRoleDesc  = (role: string) => t(`users.roleDesc.${role}` as any, '');

  const load = () => fetchUsers().then(setUsers).catch(() => toast.error(t('common.error')));
  useEffect(() => {
    load();
    fetchSites().then(data => setAllSites(data.filter((s: Site) => s.is_baustelle)));
  }, []);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const isReporting = REPORTING_ROLES.includes(form.role);
    if (form.mobile_pin && form.mobile_pin.length < 4) {
      toast.error(t('usersExtra.mobilePinMin'));
      return;
    }
    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      password: form.password,
      role: form.role,
      language: form.language,
      ...(isReporting ? { username: form.username } : { email: form.email }),
    };
    if (form.mobile_pin) payload.mobile_pin = form.mobile_pin;
    try {
      await createUser(payload);
      toast.success(t('users.created'));
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (editForm.mobile_pin && editForm.mobile_pin.length < 4) {
      toast.error(t('usersExtra.mobilePinMin') || 'PIN-ul trebuie să aibă minim 4 cifre');
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        full_name: editForm.full_name,
        role: editForm.role,
        language: editForm.language,
        notify_whatsapp: editForm.notify_whatsapp,
      };
      if (editForm.password) payload.password = editForm.password;
      if (editForm.whatsapp_number) payload.whatsapp_number = editForm.whatsapp_number;
      if (editForm.mobile_pin !== undefined) payload.mobile_pin = editForm.mobile_pin || null;
      await updateUser(selected.id, payload);
      toast.success(t('users.saved'));
      setEditMode(false);
      load();
    } catch { toast.error(t('common.error')); }
  }

  async function toggleActive(u: AppUser) {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? t('users.deactivated') : t('users.activated'));
      if (selected?.id === u.id) setSelected({ ...u, is_active: !u.is_active });
      load();
    } catch { toast.error(t('common.error')); }
  }

  async function doDelete(u: AppUser) {
    if (!confirm(t('users.confirmDelete', { name: u.full_name }))) return;
    try {
      await deleteUser(u.id);
      toast.success(t('users.deleted'));
      setSelected(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    }
  }

  function openEdit(u: AppUser) {
    setEditForm({ full_name: u.full_name, role: u.role, language: u.language, password: '', whatsapp_number: u.whatsapp_number || '', notify_whatsapp: u.notify_whatsapp || false, mobile_pin: u.mobile_pin || '' });
    setEditMode(true);
    setShowForm(false);
  }

  function togglePermEdit(moduleKey: string, u: AppUser) {
    const base = permEdits ?? u.permissions ?? {};
    const roleDefault = MODULE_ROLES[moduleKey]?.includes(u.role) ?? false;
    const currentVal = moduleKey in base ? base[moduleKey] : roleDefault;
    setPermEdits({ ...base, [moduleKey]: !currentVal });
  }

  async function savePermissions(u: AppUser) {
    if (!permEdits) return;
    setSavingPerms(true);
    try {
      await updateUser(u.id, { permissions: permEdits });
      const updated = { ...u, permissions: permEdits };
      setSelected(updated);
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
      setPermEdits(null);
      toast.success(t('users.saved'));
    } catch { toast.error(t('common.error')); }
    finally { setSavingPerms(false); }
  }

  async function saveSiteAssignment(u: AppUser) {
    if (siteEdits === null) return;
    setSavingSites(true);
    try {
      await assignSites(u.id, siteEdits);
      const updated = { ...u, assigned_site_ids: siteEdits };
      setSelected(updated);
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
      setSiteEdits(null);
      toast.success(t('users.saved'));
    } catch { toast.error(t('common.error')); }
    finally { setSavingSites(false); }
  }

  async function resetPermissions(u: AppUser) {
    try {
      await updateUser(u.id, { permissions: {} });
      const updated = { ...u, permissions: {} };
      setSelected(updated);
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
      setPermEdits(null);
      toast.success(t('users.permissionsReset'));
    } catch { toast.error(t('common.error')); }
  }

  const MODULE_LABELS: Record<string, string> = {
    dashboard:      t('users.modules.dashboard'),
    sites:          t('users.modules.sites'),
    equipment:      t('users.modules.equipment'),
    procurement:    t('users.modules.procurement'),
    hausanschluss:  t('users.modules.hausanschluss'),
    tagesbericht:   t('users.modules.tagesbericht'),
    pontaj:         t('users.modules.pontaj'),
    aufmass:        t('users.modules.aufmass'),
    lv:             t('users.modules.lv'),
    billing:        t('users.modules.billing'),
    'invoice-scan': t('users.modules.invoice-scan'),
    bauzeitenplan:  t('users.modules.bauzeitenplan'),
    hr:             t('users.modules.hr'),
    documents:      t('users.modules.documents'),
    reports:        t('users.modules.reports'),
    users:          t('users.modules.users'),
    settings:       t('users.modules.settings'),
  };

  return (
    <div className="split-layout">
      {/* List */}
      <div className="split-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
            {t('users.title')} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>({users.length})</span>
          </span>
          <button onClick={() => { setShowForm(true); setSelected(null); setEditMode(false); }} style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>{t('users.addUser')}</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {users.map(u => {
            const [bg, fg] = ROLE_COLORS[u.role] || ['#f1f5f9', '#64748b'];
            return (
              <div key={u.id} onClick={() => { setSelected(u); setShowForm(false); setEditMode(false); setPermEdits(null); setSiteEdits(null); }} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                background: selected?.id === u.id ? '#eff6ff' : '#fff',
                borderLeft: selected?.id === u.id ? '3px solid #22C55E' : '3px solid transparent',
                opacity: u.is_active ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{u.full_name}</span>
                  {!u.is_active && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{t('users.inactive')}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{u.email || u.username}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: bg, color: fg }}>
                  {getRoleLabel(u.role)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="split-content page-root">

        {/* Create form */}
        {showForm && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>{t('users.newUser')}</div>
            <form onSubmit={submitCreate} style={{
              background: '#fff', borderRadius: 12, padding: 24, maxWidth: 520,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>{t('users.fullName')} *</label>
                <input required value={form.full_name} onChange={e => f('full_name', e.target.value)} style={inp} />
              </div>

              {/* Role select first — determines email vs username */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>{t('users.role')} *</label>
                <select value={form.role} onChange={e => f('role', e.target.value)} style={inp}>
                  {ROLE_KEYS.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                </select>
              </div>

              {REPORTING_ROLES.includes(form.role) ? (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Username *</label>
                  <input required value={form.username} onChange={e => f('username', e.target.value)}
                    placeholder="ex: ion.pop" style={inp} />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                    Login cu username + PIN sau parolă. Email nu este necesar.
                  </div>
                </div>
              ) : (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>{t('common.email')} *</label>
                  <input type="email" required value={form.email} onChange={e => f('email', e.target.value)} style={inp} />
                </div>
              )}

              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>{t('users.password')} *</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} required minLength={4} value={form.password}
                    onChange={e => f('password', e.target.value)} style={{ ...inp, paddingRight: 80 }} />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#64748b',
                  }}>{showPass ? t('users.hidePass') : t('users.showPass')}</button>
                </div>
              </div>
              <div>
                <label style={lbl}>{t('users.language')}</label>
                <select value={form.language} onChange={e => f('language', e.target.value)} style={inp}>
                  {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{t('usersExtra.mobilePinLabel')}</label>
                <input
                  value={form.mobile_pin}
                  placeholder={t('usersExtra.mobilePinPlaceholder')}
                  maxLength={6}
                  onChange={e => f('mobile_pin', e.target.value.replace(/\D/g, ''))}
                  style={inp}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{t('usersExtra.mobilePinHint')}</div>
              </div>

              {/* Role description */}
              <div style={{ gridColumn: '1/-1', background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                <strong>{getRoleLabel(form.role)}:</strong>{' '}{getRoleDesc(form.role)}
              </div>

              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {t('users.createBtn')}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit form */}
        {editMode && selected && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>
              {t('users.editUser', { name: selected.full_name })}
            </div>
            <form onSubmit={submitEdit} style={{
              background: '#fff', borderRadius: 12, padding: 24, maxWidth: 520,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>{t('users.fullName')}</label>
                <input value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>{t('users.role')}</label>
                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} style={inp}>
                  {ROLE_KEYS.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{t('users.language')}</label>
                <select value={editForm.language} onChange={e => setEditForm(p => ({ ...p, language: e.target.value }))} style={inp}>
                  {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>{t('users.newPassword')} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({t('users.newPasswordHint')})</span></label>
                <input type="password" minLength={8} value={editForm.password}
                  onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>{t('users.whatsapp')}</label>
                <input value={editForm.whatsapp_number} placeholder="+49..." onChange={e => setEditForm(p => ({ ...p, whatsapp_number: e.target.value }))} style={inp} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input type="checkbox" id="notif_wa" checked={editForm.notify_whatsapp}
                  onChange={e => setEditForm(p => ({ ...p, notify_whatsapp: e.target.checked }))}
                  style={{ width: 16, height: 16 }} />
                <label htmlFor="notif_wa" style={{ fontSize: 13, cursor: 'pointer' }}>{t('users.notifyWhatsapp')}</label>
              </div>
              <div>
                <label style={lbl}>{t('usersExtra.mobilePinLabel')}</label>
                <input
                  value={editForm.mobile_pin}
                  placeholder={t('usersExtra.mobilePinPlaceholder')}
                  minLength={4}
                  maxLength={6}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    setEditForm(p => ({ ...p, mobile_pin: v }));
                  }}
                  style={inp}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                  {t('usersExtra.mobilePinHint')}
                </div>
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setEditMode(false)} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User detail */}
        {!showForm && !editMode && selected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{selected.full_name}</h2>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {selected.email || (selected.username && <span>@{selected.username}</span>)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEdit(selected)} style={{
                  padding: '7px 16px', borderRadius: 7, border: '1px solid #d1d5db',
                  background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{t('common.edit')}</button>
                <button onClick={() => toggleActive(selected)} style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: selected.is_active ? '#fef3c7' : '#d1fae5',
                  color: selected.is_active ? '#d97706' : '#059669',
                }}>{selected.is_active ? t('users.deactivate') : t('users.activate')}</button>
                <button onClick={() => doDelete(selected)} style={{
                  padding: '7px 16px', borderRadius: 7, border: '1px solid #fca5a5',
                  background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{t('common.delete')}</button>
              </div>
            </div>

            {/* Role card */}
            {(() => {
              const [bg, fg] = ROLE_COLORS[selected.role] || ['#f1f5f9', '#64748b'];
              return (
                <div style={{ background: bg, borderRadius: 10, padding: '16px 20px', marginBottom: 20, maxWidth: 400 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: fg, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{t('users.role')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: fg }}>{getRoleLabel(selected.role)}</div>
                  <div style={{ fontSize: 13, color: fg, opacity: 0.8, marginTop: 4 }}>{getRoleDesc(selected.role)}</div>
                </div>
              );
            })()}

            {/* Permissions table — editable toggles */}
            <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', maxWidth: 560, border: '1px solid var(--border)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{t('users.permissionsTitle')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(Object.keys(selected.permissions || {}).length > 0 || permEdits !== null) && (
                    <button onClick={() => { resetPermissions(selected); }} style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, color: 'var(--text-2)', cursor: 'pointer',
                    }}>
                      {t('users.resetPermissions')}
                    </button>
                  )}
                  {permEdits !== null && (
                    <button onClick={() => savePermissions(selected)} disabled={savingPerms} style={{
                      background: '#22C55E', border: 'none', borderRadius: 6, color: '#fff',
                      padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: savingPerms ? 0.6 : 1,
                    }}>
                      {savingPerms ? t('common.loading') : t('users.savePermissions')}
                    </button>
                  )}
                </div>
              </div>
              {Object.entries(MODULE_LABELS).map(([key, label]) => {
                const saved = selected.permissions ?? {};
                const active = permEdits ?? saved;
                const roleDefault = MODULE_ROLES[key]?.includes(selected.role) ?? false;
                const isCustomSaved = key in saved;
                const hasAccess = key in active ? active[key] : roleDefault;
                const isDirty = permEdits !== null && (key in permEdits) && permEdits[key] !== (isCustomSaved ? saved[key] : roleDefault);
                return (
                  <div key={key} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</span>
                    {isCustomSaved && !isDirty && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4 }}>
                        {t('users.customPerm')}
                      </span>
                    )}
                    {isDirty && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>
                        •
                      </span>
                    )}
                    <button
                      onClick={() => togglePermEdit(key, selected)}
                      style={{
                        width: 42, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                        background: hasAccess ? '#22C55E' : '#d1d5db',
                        position: 'relative', flexShrink: 0, transition: 'background 150ms',
                        padding: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 2, left: hasAccess ? 22 : 2,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left 150ms', display: 'block',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Site assignment — only for field roles */}
            {['polier','sef_santier','aufmass','projekt_leiter'].includes(selected.role) && (
              <div style={{ marginTop: 20, background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', maxWidth: 560, border: '1px solid var(--border)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Șantiere atribuite</span>
                  {siteEdits !== null && (
                    <button onClick={() => saveSiteAssignment(selected)} disabled={savingSites} style={{
                      background: '#22C55E', border: 'none', borderRadius: 6, color: '#fff',
                      padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: savingSites ? 0.6 : 1,
                    }}>
                      {savingSites ? t('common.loading') : t('users.savePermissions')}
                    </button>
                  )}
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allSites.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 4px' }}>Nu există șantiere active.</div>}
                  {allSites.map(site => {
                    const active = siteEdits ?? selected.assigned_site_ids ?? [];
                    const checked = active.includes(site.id);
                    return (
                      <label key={site.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 8px', borderRadius: 6, background: checked ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          const cur = siteEdits ?? selected.assigned_site_ids ?? [];
                          setSiteEdits(checked ? cur.filter(id => id !== site.id) : [...cur, site.id]);
                        }} style={{ width: 15, height: 15, accentColor: '#22C55E' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', minWidth: 36 }}>{site.kostenstelle}</span>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: checked ? 600 : 400 }}>{site.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
              {t('users.language')}: <strong>{LANGS.find(l => l.value === selected.language)?.label}</strong>
              {' · '}
              {t('common.status')}: <strong style={{ color: selected.is_active ? '#059669' : '#dc2626' }}>
                {selected.is_active ? t('common.active') : t('common.inactive')}
              </strong>
            </div>
          </div>
        )}

        {!showForm && !editMode && !selected && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#94a3b8', gap: 12 }}>
            <div style={{ fontSize: 15 }}>{t('users.noUserSelected')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {ROLE_KEYS.map(r => {
                const [bg, fg] = ROLE_COLORS[r];
                return (
                  <span key={r} style={{ padding: '4px 12px', borderRadius: 20, background: bg, color: fg, fontSize: 11, fontWeight: 700 }}>
                    {getRoleLabel(r)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
