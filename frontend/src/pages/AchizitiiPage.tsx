import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  fetchSuppliers, createSupplier, getSupplier, updateSupplier, deleteSupplier,
  addPrice, updatePrice, deletePrice,
  fetchOrders, createOrder, updateOrder, deleteOrder,
  searchPrices, PriceSearchResult,
} from '../api/achizitii';
import { fetchSites } from '../api/sites';
import type { Supplier, SupplierPrice, PurchaseOrder, Site } from '../types';

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 7, border: 'none',
  background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db',
  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151',
};
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fef3c7', color: '#92400e' },
  approved:  { bg: '#d1fae5', color: '#065f46' },
  sent:      { bg: '#dbeafe', color: '#1e40af' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const s = STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#475569' };
  const label = STATUS_COLORS[status]
    ? t(`procurement.orderStatus.${status}`)
    : status;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────

function SuppliersTab() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editPriceForm, setEditPriceForm] = useState({ product_name: '', unit: 'buc', price: '', currency: 'EUR' });

  const [form, setForm] = useState({ name: '', email: '', email2: '', phone: '', notes: '' });
  const [priceForm, setPriceForm] = useState({ product_name: '', unit: 'buc', price: '', currency: 'EUR' });

  const load = () => fetchSuppliers().then(setSuppliers).catch(() => toast.error(t('common.error')));

  useEffect(() => { load(); }, []);

  const loadSelected = (id: number) => getSupplier(id).then(s => { setSelected(s); }).catch(() => toast.error(t('common.error')));

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const pf = (k: string, v: string) => setPriceForm(p => ({ ...p, [k]: v }));

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editMode && selected) {
        await updateSupplier(selected.id, form);
        toast.success(t('procurement.supplierSaved'));
      } else {
        await createSupplier(form);
        toast.success(t('procurement.supplierAdded'));
      }
      setShowForm(false); setEditMode(false); setForm({ name: '', email: '', email2: '', phone: '', notes: '' });
      load();
      if (selected) loadSelected(selected.id);
    } catch { toast.error(t('common.error')); }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(t('procurement.confirmDeleteSupplier', { name: selected.name }))) return;
    try {
      await deleteSupplier(selected.id);
      toast.success(t('procurement.supplierDeleted'));
      setSelected(null); load();
    } catch { toast.error(t('procurement.supplierHasLinked')); }
  }

  async function handleToggleActive() {
    if (!selected) return;
    await updateSupplier(selected.id, { is_active: !selected.is_active });
    loadSelected(selected.id); load();
  }

  async function handleAddPrice(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await addPrice(selected.id, { ...priceForm, price: parseFloat(priceForm.price) });
      toast.success(t('procurement.priceAdded'));
      setShowPriceForm(false); setPriceForm({ product_name: '', unit: 'buc', price: '', currency: 'EUR' });
      loadSelected(selected.id);
    } catch { toast.error(t('common.error')); }
  }

  function openEditPrice(p: SupplierPrice) {
    setEditingPriceId(p.id);
    setEditPriceForm({ product_name: p.product_name, unit: p.unit, price: String(p.price), currency: p.currency });
  }

  async function handleSavePrice(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || editingPriceId === null) return;
    try {
      await updatePrice(selected.id, editingPriceId, { ...editPriceForm, price: parseFloat(editPriceForm.price) });
      toast.success(t('procurement.priceUpdated'));
      setEditingPriceId(null);
      loadSelected(selected.id);
    } catch { toast.error(t('common.error')); }
  }

  async function handleDeletePrice(priceId: number) {
    if (!selected) return;
    if (!confirm(t('procurement.confirmDeletePrice'))) return;
    try {
      await deletePrice(selected.id, priceId);
      toast.success(t('procurement.priceDeleted'));
      loadSelected(selected.id);
    } catch { toast.error(t('common.error')); }
  }

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      {/* List panel */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder={t('procurement.searchSupplier')} value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, flex: 1 }} />
          <button style={btnPrimary} onClick={() => { setShowForm(true); setEditMode(false); setForm({ name: '', email: '', email2: '', phone: '', notes: '' }); }}>+ {t('common.new')}</button>
        </div>

        {showForm && (
          <div style={{ ...card, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
              {editMode ? t('procurement.editSupplier') : t('procurement.newSupplier')}
            </div>
            <form onSubmit={handleSaveSupplier}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><label style={lbl}>{t('common.name')} *</label><input required value={form.name} onChange={e => f('name', e.target.value)} style={inp} /></div>
                <div><label style={lbl}>{t('common.email')} *</label><input required type="email" value={form.email} onChange={e => f('email', e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Email 2</label><input value={form.email2} onChange={e => f('email2', e.target.value)} style={inp} /></div>
                <div><label style={lbl}>{t('common.phone')}</label><input value={form.phone} onChange={e => f('phone', e.target.value)} style={inp} /></div>
                <div><label style={lbl}>{t('common.notes')}</label><textarea value={form.notes} onChange={e => f('notes', e.target.value)} style={{ ...inp, height: 60, resize: 'vertical' }} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={btnPrimary}>{t('common.save')}</button>
                  <button type="button" style={btnSecondary} onClick={() => { setShowForm(false); setEditMode(false); }}>{t('common.cancel')}</button>
                </div>
              </div>
            </form>
          </div>
        )}

        <div style={card}>
          {filtered.length === 0 && (
            <div style={{ padding: 20, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{t('procurement.noSuppliers')}</div>
          )}
          {filtered.map(s => (
            <div key={s.id} onClick={() => loadSelected(s.id)}
              style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                background: selected?.id === s.id ? '#eff6ff' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.email}</div>
              </div>
              {!s.is_active && (
                <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '2px 7px', borderRadius: 10 }}>{t('common.inactive')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div style={{ flex: 1 }}>
          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{selected.email}</div>
                {selected.email2 && <div style={{ fontSize: 12, color: '#94a3b8' }}>{selected.email2}</div>}
                {selected.phone && <div style={{ fontSize: 12, color: '#94a3b8' }}>{selected.phone}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => {
                  setForm({ name: selected.name, email: selected.email, email2: selected.email2 || '', phone: selected.phone || '', notes: selected.notes || '' });
                  setEditMode(true); setShowForm(true);
                }}>{t('common.edit')}</button>
                <button style={{ ...btnSecondary, color: selected.is_active ? '#d97706' : '#16a34a' }} onClick={handleToggleActive}>
                  {selected.is_active ? t('procurement.deactivate') : t('procurement.activate')}
                </button>
                <button style={{ ...btnSecondary, color: '#dc2626' }} onClick={handleDelete}>{t('common.delete')}</button>
              </div>
            </div>

            {selected.notes && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 12, color: '#475569', marginBottom: 20 }}>
                {selected.notes}
              </div>
            )}

            {/* Price list */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>{t('procurement.priceList').toUpperCase()}</div>
                <button style={btnPrimary} onClick={() => setShowPriceForm(p => !p)}>
                  {showPriceForm ? t('common.cancel') : `+ ${t('procurement.addPrice')}`}
                </button>
              </div>

              {showPriceForm && (
                <form onSubmit={handleAddPrice} style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px', gap: 10, alignItems: 'end' }}>
                    <div><label style={lbl}>{t('procurement.product')} *</label><input required value={priceForm.product_name} onChange={e => pf('product_name', e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>{t('procurement.colUnit')}</label><input value={priceForm.unit} onChange={e => pf('unit', e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>{t('procurement.colPrice')} *</label><input required type="number" step="0.01" value={priceForm.price} onChange={e => pf('price', e.target.value)} style={inp} /></div>
                    <div><label style={lbl}>{t('common.currency')}</label>
                      <select value={priceForm.currency} onChange={e => pf('currency', e.target.value)} style={inp}>
                        <option>EUR</option><option>RON</option><option>USD</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button type="submit" style={btnPrimary}>{t('procurement.addPrice')}</button>
                  </div>
                </form>
              )}

              {(!selected.prices || selected.prices.length === 0) ? (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>{t('procurement.noPrices')}</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colProduct').toUpperCase()}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colPrice').toUpperCase()}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colUnit').toUpperCase()}</th>
                      <th style={{ padding: '8px 4px', width: 70 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.prices as SupplierPrice[]).map(p => (
                      editingPriceId === p.id ? (
                        <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9', background: '#eff6ff' }}>
                          <td colSpan={4} style={{ padding: '8px 12px' }}>
                            <form onSubmit={handleSavePrice} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 70px auto auto', gap: 8, alignItems: 'center' }}>
                              <input required value={editPriceForm.product_name}
                                onChange={e => setEditPriceForm(p => ({ ...p, product_name: e.target.value }))}
                                style={{ ...inp, fontSize: 12 }} placeholder={t('procurement.product')} />
                              <input value={editPriceForm.unit}
                                onChange={e => setEditPriceForm(p => ({ ...p, unit: e.target.value }))}
                                style={{ ...inp, fontSize: 12 }} placeholder={t('procurement.colUnit')} />
                              <input required type="number" step="0.01" value={editPriceForm.price}
                                onChange={e => setEditPriceForm(p => ({ ...p, price: e.target.value }))}
                                style={{ ...inp, fontSize: 12 }} placeholder={t('procurement.colPrice')} />
                              <select value={editPriceForm.currency}
                                onChange={e => setEditPriceForm(p => ({ ...p, currency: e.target.value }))}
                                style={{ ...inp, fontSize: 12 }}>
                                <option>EUR</option><option>RON</option><option>USD</option>
                              </select>
                              <button type="submit" style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}>✓</button>
                              <button type="button" style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}
                                onClick={() => setEditingPriceId(null)}>✕</button>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 12px', color: '#1e293b' }}>{p.product_name}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#22C55E' }}>
                            {p.price.toFixed(2)} {p.currency}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>{p.unit}</td>
                          <td style={{ padding: '9px 4px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => openEditPrice(p)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22C55E', fontSize: 13, marginRight: 4 }}>✎</button>
                            <button onClick={() => handleDeletePrice(p.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14 }}>✕</button>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
          {t('procurement.selectSupplier')}
        </div>
      )}
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

interface OrderItem {
  supplier_id: number;
  product_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

function OrdersTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? 'de-DE' : i18n.language === 'en' ? 'en-US' : 'ro-RO';
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const [form, setForm] = useState({ site_id: '', notes: '' });
  const [items, setItems] = useState<OrderItem[]>([
    { supplier_id: 0, product_name: '', quantity: '', unit: 'buc', unit_price: '' },
  ]);

  const loadOrders = (status?: string) =>
    fetchOrders(status ? { status } : undefined).then(setOrders).catch(() => toast.error(t('common.error')));

  useEffect(() => {
    loadOrders();
    fetchSuppliers().then(setSuppliers);
    fetchSites().then(setSites);
  }, []);

  const addItem = () => setItems(p => [...p, { supplier_id: 0, product_name: '', quantity: '', unit: 'buc', unit_price: '' }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItemField = (i: number, k: keyof OrderItem, v: string | number) =>
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter(i => i.supplier_id && i.product_name && i.quantity && i.unit_price);
    if (validItems.length === 0) { toast.error(t('procurement.addItem')); return; }
    try {
      await createOrder({
        site_id: form.site_id ? parseInt(form.site_id) : null,
        notes: form.notes,
        items: validItems.map(i => ({
          supplier_id: Number(i.supplier_id),
          product_name: i.product_name,
          quantity: parseFloat(i.quantity),
          unit: i.unit,
          unit_price: parseFloat(i.unit_price),
        })),
      });
      toast.success(t('procurement.orderCreated'));
      setShowForm(false);
      setForm({ site_id: '', notes: '' });
      setItems([{ supplier_id: 0, product_name: '', quantity: '', unit: 'buc', unit_price: '' }]);
      loadOrders(filterStatus || undefined);
    } catch { toast.error(t('common.error')); }
  }

  async function handleStatusChange(status: string) {
    if (!selected) return;
    try {
      const updated = await updateOrder(selected.id, { status });
      setSelected(updated);
      toast.success(t('procurement.orderUpdated'));
      loadOrders(filterStatus || undefined);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    }
  }

  async function handleDeleteOrder() {
    if (!selected) return;
    if (!confirm(t('procurement.confirmDeleteOrder'))) return;
    try {
      await deleteOrder(selected.id);
      toast.success(t('procurement.orderDeleted'));
      setSelected(null);
      loadOrders(filterStatus || undefined);
    } catch { toast.error(t('common.error')); }
  }

  const computedTotal = items.reduce((sum, i) => {
    const q = parseFloat(i.quantity) || 0;
    const p = parseFloat(i.unit_price) || 0;
    return sum + q * p;
  }, 0);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); loadOrders(e.target.value || undefined); }}
          style={{ ...inp, width: 180 }}>
          <option value="">{t('hr.allStatuses')}</option>
          <option value="pending">{t('procurement.orderStatus.pending')}</option>
          <option value="approved">{t('procurement.orderStatus.approved')}</option>
          <option value="sent">{t('procurement.orderStatus.sent')}</option>
          <option value="cancelled">{t('procurement.orderStatus.cancelled')}</option>
        </select>
        <button style={btnPrimary} onClick={() => setShowForm(p => !p)}>
          {showForm ? t('common.cancel') : `+ ${t('procurement.addOrder')}`}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ ...card, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>{t('procurement.addOrder')}</div>
          <form onSubmit={handleCreateOrder}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={lbl}>{t('procurement.site')}</label>
                <select value={form.site_id} onChange={e => setForm(p => ({ ...p, site_id: e.target.value }))} style={inp}>
                  <option value="">{t('billing.noSiteOption')}</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{t('common.notes')}</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inp} />
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('procurement.addItem').toUpperCase()}</span>
                <button type="button" onClick={addItem} style={{ ...btnSecondary, fontSize: 12, padding: '4px 12px' }}>{t('procurement.addItem')}</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 80px 80px 100px 36px', gap: 8, alignItems: 'end' }}>
                    <div>
                      {i === 0 && <label style={lbl}>{t('procurement.colSupplier')}</label>}
                      <select value={item.supplier_id} onChange={e => setItemField(i, 'supplier_id', Number(e.target.value))} style={inp}>
                        <option value={0}>— {t('common.select')} —</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      {i === 0 && <label style={lbl}>{t('procurement.colProduct')}</label>}
                      <input value={item.product_name} onChange={e => setItemField(i, 'product_name', e.target.value)} style={inp} placeholder={t('procurement.product')} />
                    </div>
                    <div>
                      {i === 0 && <label style={lbl}>{t('procurement.colQty')}</label>}
                      <input type="number" step="0.01" value={item.quantity} onChange={e => setItemField(i, 'quantity', e.target.value)} style={inp} placeholder="0" />
                    </div>
                    <div>
                      {i === 0 && <label style={lbl}>{t('procurement.colUnit')}</label>}
                      <input value={item.unit} onChange={e => setItemField(i, 'unit', e.target.value)} style={inp} />
                    </div>
                    <div>
                      {i === 0 && <label style={lbl}>{t('procurement.colPrice')}</label>}
                      <input type="number" step="0.01" value={item.unit_price} onChange={e => setItemField(i, 'unit_price', e.target.value)} style={inp} placeholder="0.00" />
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right', marginTop: 10, fontSize: 14, fontWeight: 700, color: '#22C55E' }}>
                {t('procurement.totalAmount')}: {computedTotal.toFixed(2)} EUR
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={btnPrimary}>{t('procurement.orderCreated')}</button>
              <button type="button" style={btnSecondary} onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Two-column: list + detail */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Orders list */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <div style={card}>
            {orders.length === 0 && (
              <div style={{ padding: 20, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{t('procurement.noOrders')}</div>
            )}
            {orders.map(o => (
              <div key={o.id} onClick={() => setSelected(o)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                  background: selected?.id === o.id ? '#eff6ff' : '#fff',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>#{o.id}</div>
                  <StatusBadge status={o.status} />
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {o.site_name || t('common.noData')} · {o.items?.length || 0} articole
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {o.total_amount.toFixed(2)} EUR · {new Date(o.created_at).toLocaleDateString(locale)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order detail */}
        {selected ? (
          <div style={{ flex: 1 }}>
            <div style={{ ...card, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>#{selected.id}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {selected.requester_name} · {new Date(selected.created_at).toLocaleDateString(locale)}
                    {selected.site_name && ` · ${selected.site_name}`}
                  </div>
                  {selected.approved_at && (
                    <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
                      {t('procurement.orderStatus.approved')}: {new Date(selected.approved_at).toLocaleDateString(locale)}
                    </div>
                  )}
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {selected.notes && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 12, color: '#475569', marginBottom: 16 }}>
                  {selected.notes}
                </div>
              )}

              {/* Items table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colSupplier').toUpperCase()}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colProduct').toUpperCase()}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colQty').toUpperCase()}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colPrice').toUpperCase()}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{t('procurement.colTotal').toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items?.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{item.supplier_name}</td>
                      <td style={{ padding: '9px 12px', color: '#1e293b' }}>{item.product_name}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#475569' }}>{item.quantity} {item.unit}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#475569' }}>{item.unit_price.toFixed(2)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{item.total_price.toFixed(2)} EUR</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#22C55E' }}>{t('common.total').toUpperCase()}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#22C55E', fontSize: 15 }}>
                      {selected.total_amount.toFixed(2)} EUR
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected.status === 'pending' && (
                  <>
                    <button style={{ ...btnPrimary, background: '#16a34a' }} onClick={() => handleStatusChange('approved')}>{t('procurement.approve')}</button>
                    <button style={{ ...btnSecondary, color: '#dc2626' }} onClick={() => handleStatusChange('cancelled')}>{t('common.cancel')}</button>
                  </>
                )}
                {selected.status === 'approved' && (
                  <>
                    <button style={{ ...btnPrimary, background: '#22C55E' }} onClick={() => handleStatusChange('sent')}>{t('procurement.sendOrder')}</button>
                    <button style={{ ...btnSecondary, color: '#dc2626' }} onClick={() => handleStatusChange('cancelled')}>{t('common.cancel')}</button>
                  </>
                )}
                {selected.status === 'sent' && (
                  <button style={{ ...btnSecondary, color: '#dc2626' }} onClick={() => handleStatusChange('cancelled')}>{t('common.cancel')}</button>
                )}
                {['pending', 'cancelled'].includes(selected.status) && (
                  <button style={{ ...btnSecondary, color: '#dc2626', marginLeft: 'auto' }} onClick={handleDeleteOrder}>{t('common.delete')}</button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
            {t('procurement.selectOrder')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Price Search Tab ─────────────────────────────────────────────────────────

interface CartItem {
  price: PriceSearchResult;
  quantity: number;
}

function PriceSearchTab() {
  const { t } = useTranslation();
  const [lines, setLines] = useState<string[]>(['']);          // product name input list
  const [results, setResults] = useState<Record<string, PriceSearchResult[]>>({});
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [orderSite, setOrderSite] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchSites().then(setSites); }, []);

  function setLine(i: number, val: string) {
    setLines(prev => {
      const next = [...prev];
      next[i] = val;
      // auto-add new empty row when typing in last row
      if (i === prev.length - 1 && val.trim()) next.push('');
      return next;
    });
  }

  function removeLine(i: number) {
    setLines(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [''];
    });
    setResults(prev => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  }

  async function searchAll() {
    const terms = lines.map(l => l.trim()).filter(Boolean);
    if (!terms.length) return;
    setLoading(true);
    try {
      const byTerm: Record<string, PriceSearchResult[]> = {};
      await Promise.all(terms.map(async (term, i) => {
        const res = await searchPrices(term);
        byTerm[i] = res;
      }));
      setResults(byTerm);
    } catch { toast.error(t('common.error')); }
    finally { setLoading(false); }
  }

  function addToCart(price: PriceSearchResult) {
    setCart(prev => {
      const exists = prev.findIndex(c => c.price.id === price.id);
      if (exists >= 0) return prev;
      return [...prev, { price, quantity: 1 }];
    });
  }

  function removeFromCart(priceId: number) {
    setCart(prev => prev.filter(c => c.price.id !== priceId));
  }

  function setQty(priceId: number, qty: number) {
    setCart(prev => prev.map(c => c.price.id === priceId ? { ...c, quantity: qty } : c));
  }

  async function handleCreateOrder() {
    if (!cart.length) { toast.error(t('procurement.addItem')); return; }
    setSubmitting(true);
    try {
      await createOrder({
        site_id: orderSite ? parseInt(orderSite) : null,
        notes: orderNotes,
        items: cart.map(c => ({
          supplier_id: c.price.supplier_id,
          product_name: c.price.product_name,
          quantity: c.quantity,
          unit: c.price.unit,
          unit_price: c.price.price,
        })),
      });
      toast.success(t('procurement.orderCreated'));
      setCart([]);
      setLines(['']);
      setResults({});
      setOrderSite('');
      setOrderNotes('');
    } catch { toast.error(t('common.error')); }
    finally { setSubmitting(false); }
  }

  const activeLine = lines.map(l => l.trim()).filter(Boolean);
  const totalCart = cart.reduce((s, c) => s + c.price.price * c.quantity, 0);
  const cartCurrency = cart[0]?.price.currency ?? 'EUR';

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* LEFT — product list + results */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Input list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Listă produse</span>
            <button onClick={searchAll} disabled={loading || !activeLine.length}
              className="btn-primary" style={{ fontSize: 13, padding: '7px 18px', opacity: loading || !activeLine.length ? 0.6 : 1 }}>
              {loading ? t('common.loading') : 'Caută prețuri'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 20, textAlign: 'right', fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{i + 1}.</span>
                <input
                  value={line}
                  onChange={e => setLine(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAll(); } }}
                  placeholder={`Produs ${i + 1} (ex: cablu FTP, teavă PVC...)`}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface-2)', color: 'var(--text)' }}
                />
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setLines(prev => [...prev, ''])} style={{ marginTop: 10, background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '5px 14px', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', width: '100%' }}>
            + Adaugă produs
          </button>
        </div>

        {/* Results per product */}
        {Object.keys(results).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lines.map((line, i) => {
              if (!line.trim()) return null;
              const res = results[i] ?? [];
              return (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  {/* Product header */}
                  <div style={{ padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>#{i + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{line}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>{res.length} rezultate</span>
                  </div>

                  {res.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>Niciun preț găsit în lista furnizorilor</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Produs', 'Furnizor', 'Preț', 'UM', ''].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {res.map(p => {
                          const inCart = cart.some(c => c.price.id === p.id);
                          return (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 500 }}>{p.product_name}</td>
                              <td style={{ padding: '9px 14px', color: 'var(--text-2)' }}>{p.supplier_name}</td>
                              <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                                {p.price.toFixed(2)} {p.currency}
                              </td>
                              <td style={{ padding: '9px 14px', color: 'var(--text-3)' }}>{p.unit}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                                <button
                                  onClick={() => addToCart(p)}
                                  disabled={inCart}
                                  style={{
                                    padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: inCart ? 'default' : 'pointer',
                                    background: inCart ? 'var(--surface-3)' : 'var(--green)', color: inCart ? 'var(--text-3)' : '#fff',
                                  }}
                                >
                                  {inCart ? '✓ Adăugat' : '+ Coș'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT — Cart / Order */}
      <div style={{ width: 340, flexShrink: 0, position: 'sticky', top: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Coș comandă</span>
            {cart.length > 0 && (
              <span style={{ background: 'var(--green)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{cart.length}</span>
            )}
          </div>

          {cart.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Caută produse și adaugă-le în coș
            </div>
          ) : (
            <>
              {/* Cart items */}
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {cart.map(c => (
                  <div key={c.price.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.price.product_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.price.supplier_name}</div>
                      </div>
                      <button onClick={() => removeFromCart(c.price.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="number" min={0.01} step={0.01}
                        value={c.quantity}
                        onChange={e => setQty(c.price.id, parseFloat(e.target.value) || 1)}
                        style={{ width: 70, padding: '4px 7px', borderRadius: 5, border: '1px solid var(--border)', fontSize: 13, textAlign: 'right', background: 'var(--surface-2)', color: 'var(--text)' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.price.unit}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                        {(c.price.price * c.quantity).toFixed(2)} {c.price.currency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Total estimat</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {totalCart.toFixed(2)} {cartCurrency}
                </span>
              </div>

              {/* Order form */}
              <div style={{ padding: '14px' }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Șantier</label>
                  <select value={orderSite} onChange={e => setOrderSite(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface-2)', color: 'var(--text)' }}>
                    <option value="">— Fără șantier —</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note</label>
                  <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', background: 'var(--surface-2)', color: 'var(--text)' }} placeholder="Note opționale..." />
                </div>
                <button onClick={handleCreateOrder} disabled={submitting}
                  className="btn-primary" style={{ width: '100%', fontSize: 14, padding: '10px', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? t('common.loading') : 'Creează comanda'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AchizitiiPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'suppliers' | 'orders' | 'search'>('suppliers');

  return (
    <div className="page-root">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{t('procurement.title')}</h1>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t('procurement.tabs.suppliers')} & {t('procurement.tabs.orders')}</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e2e8f0' }}>
        {([['suppliers', t('procurement.tabs.suppliers')], ['orders', t('procurement.tabs.orders')], ['search', t('procurement.tabs.priceSearch')]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              color: tab === key ? '#22C55E' : '#64748b',
              borderBottom: tab === key ? '2px solid #22C55E' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'search' ? <PriceSearchTab /> : tab === 'suppliers' ? <SuppliersTab /> : <OrdersTab />}
    </div>
  );
}
