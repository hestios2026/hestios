import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { scanInvoice, confirmInvoice, InvoiceProposal, LineItem } from '../api/invoices';
import { fetchSites } from '../api/sites';
import type { Site } from '../types';

const COST_CATEGORIES = [
  { value: 'materiale',      label: 'Materiale' },
  { value: 'manopera',       label: 'Manoperă' },
  { value: 'subcontractori', label: 'Subcontractori' },
  { value: 'utilaje',        label: 'Utilaje' },
  { value: 'combustibil',    label: 'Combustibil' },
  { value: 'transport',      label: 'Transport' },
  { value: 'alte',           label: 'Alte' },
];

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#fff',
};
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 };
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 };

function formatMoney(n: number | string, currency = 'EUR') {
  const num = typeof n === 'string' ? parseFloat(n) || 0 : n;
  return `${num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// ─── Line items editor ────────────────────────────────────────────────────────

function LineItemsEditor({ items, currency, onChange }: {
  items: LineItem[];
  currency: string;
  onChange: (items: LineItem[]) => void;
}) {
  function update(i: number, field: keyof LineItem, val: string) {
    const next = items.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: field === 'description' || field === 'unit' ? val : parseFloat(val) || 0 };
      if (field === 'quantity' || field === 'unit_price') {
        updated.total = updated.quantity * updated.unit_price;
      }
      return updated;
    });
    onChange(next);
  }

  function addRow() {
    onChange([...items, { description: '', quantity: 1, unit: 'buc', unit_price: 0, total: 0 }]);
  }

  function removeRow(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 80px 70px 100px 100px 32px', gap: 6, marginBottom: 6 }}>
        {['Descriere', 'Cant.', 'U.M.', 'Preț/u.', 'Total', ''].map(h => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</div>
        ))}
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 80px 70px 100px 100px 32px', gap: 6, marginBottom: 6 }}>
          <input value={it.description} onChange={e => update(i, 'description', e.target.value)} style={inp} />
          <input type="number" value={it.quantity} onChange={e => update(i, 'quantity', e.target.value)} style={inp} />
          <input value={it.unit} onChange={e => update(i, 'unit', e.target.value)} style={inp} />
          <input type="number" value={it.unit_price} onChange={e => update(i, 'unit_price', e.target.value)} style={inp} />
          <div style={{ ...inp, background: '#f8fafc', color: '#374151', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            {formatMoney(it.total, currency)}
          </div>
          <button onClick={() => removeRow(i)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      ))}
      <button onClick={addRow} style={{ marginTop: 4, padding: '5px 14px', borderRadius: 6, border: '1px dashed #d1d5db', background: '#f8fafc', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
        + Linie nouă
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function InvoiceScannerPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [proposal, setProposal] = useState<InvoiceProposal | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [siteId, setSiteId] = useState('');
  const [category, setCategory] = useState('materiale');
  const [saveDoc, setSaveDoc] = useState(true);
  const [done, setDone] = useState<{ cost_id: number; doc_id: number | null } | null>(null);

  useEffect(() => {
    fetchSites(false).then(setSites).catch(() => {});
  }, []);

  async function handleFile(file: File) {
    if (!file.type.includes('pdf') && !file.type.startsWith('image/')) {
      toast.error('Doar PDF sau imagini'); return;
    }
    setSelectedFile(file);
    setProposal(null);
    setDone(null);
    setScanning(true);
    try {
      const result = await scanInvoice(file);
      setProposal(result);
      toast.success('Factură analizată');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Eroare la scanare');
    } finally {
      setScanning(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function p(field: keyof InvoiceProposal, val: any) {
    setProposal(prev => prev ? { ...prev, [field]: val } : prev);
  }

  function recalcTotals(items: LineItem[]) {
    if (!proposal) return;
    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const vat_amount = subtotal * (proposal.vat_rate / 100);
    setProposal(prev => prev ? { ...prev, line_items: items, subtotal, vat_amount, total: subtotal + vat_amount } : prev);
  }

  async function handleConfirm() {
    if (!proposal) return;
    if (!siteId) { toast.error('Selectează un șantier'); return; }
    setConfirming(true);
    try {
      const result = await confirmInvoice(proposal, parseInt(siteId), category, saveDoc);
      setDone(result);
      toast.success('Cost înregistrat cu succes');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Eroare la confirmare');
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setProposal(null); setSelectedFile(null); setDone(null); setSiteId(''); setCategory('materiale');
  }

  return (
    <div className="page-root" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>Scanare facturi</h1>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Încarcă un PDF sau imagine — datele sunt extrase automat cu OCR + Claude AI
        </div>
      </div>

      {/* Success state */}
      {done && (
        <div style={{ ...card, borderLeft: '4px solid #059669', marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#059669', marginBottom: 8 }}>Cost înregistrat</div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            ID Cost: <strong>#{done.cost_id}</strong>
            {done.doc_id && <> · Document salvat: <strong>#{done.doc_id}</strong></>}
          </div>
          <button onClick={reset} style={{ marginTop: 14, padding: '8px 20px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Scanează altă factură
          </button>
        </div>
      )}

      {!done && (
        <div style={{ display: 'grid', gridTemplateColumns: proposal ? '340px 1fr' : '1fr', gap: 24 }}>

          {/* Upload zone */}
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !scanning && fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? '#1d4ed8' : '#d1d5db'}`,
                borderRadius: 12, padding: '40px 24px', textAlign: 'center',
                cursor: scanning ? 'wait' : 'pointer',
                background: dragging ? '#eff6ff' : scanning ? '#f8fafc' : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {scanning ? (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>Se analizează factura...</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Extragere text + Claude AI</div>
                </div>
              ) : selectedFile ? (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{selectedFile.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Click pentru alt fișier</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    Trage factura aici sau <strong style={{ color: '#1d4ed8' }}>selectează fișier</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>PDF, JPG, PNG — max 20 MB</div>
                </div>
              )}
            </div>

            {/* Assignment */}
            {proposal && !done && (
              <div style={{ ...card, marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>Atribuire cost</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Șantier *</label>
                  <select value={siteId} onChange={e => setSiteId(e.target.value)} style={inp}>
                    <option value="">— Selectează —</option>
                    {sites.filter(s => s.is_baustelle).map(s => (
                      <option key={s.id} value={s.id}>{s.kostenstelle} — {s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Categorie</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={inp}>
                    {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <input type="checkbox" id="savedoc" checked={saveDoc} onChange={e => setSaveDoc(e.target.checked)} />
                  <label htmlFor="savedoc" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Salvează PDF în Documente</label>
                </div>
                <button onClick={handleConfirm} disabled={confirming || !siteId}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: !siteId ? '#e2e8f0' : '#059669', color: '#fff', fontWeight: 800, fontSize: 14, cursor: !siteId ? 'not-allowed' : 'pointer', opacity: confirming ? 0.7 : 1 }}>
                  {confirming ? 'Se înregistrează...' : 'Confirmă și înregistrează cost'}
                </button>
              </div>
            )}
          </div>

          {/* Proposal editor */}
          {proposal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Header fields */}
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>Date factură</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Furnizor</label>
                    <input value={proposal.supplier_name} onChange={e => p('supplier_name', e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Nr. factură</label>
                    <input value={proposal.invoice_nr} onChange={e => p('invoice_nr', e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Monedă</label>
                    <select value={proposal.currency} onChange={e => p('currency', e.target.value)} style={inp}>
                      <option>EUR</option><option>RON</option><option>USD</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Dată factură</label>
                    <input type="date" value={proposal.invoice_date || ''} onChange={e => p('invoice_date', e.target.value || null)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Scadență</label>
                    <input type="date" value={proposal.due_date || ''} onChange={e => p('due_date', e.target.value || null)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>TVA (%)</label>
                    <input type="number" value={proposal.vat_rate} onChange={e => {
                      const vat_rate = parseFloat(e.target.value) || 0;
                      const vat_amount = proposal.subtotal * (vat_rate / 100);
                      setProposal(prev => prev ? { ...prev, vat_rate, vat_amount, total: prev.subtotal + vat_amount } : prev);
                    }} style={inp} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Observații</label>
                  <input value={proposal.notes} onChange={e => p('notes', e.target.value)} style={inp} />
                </div>
              </div>

              {/* Line items */}
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>Linii factură</div>
                <LineItemsEditor items={proposal.line_items} currency={proposal.currency} onChange={recalcTotals} />
              </div>

              {/* Totals */}
              <div style={{ ...card, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ minWidth: 280 }}>
                  {[
                    ['Subtotal', proposal.subtotal],
                    [`TVA ${proposal.vat_rate}%`, proposal.vat_amount],
                  ].map(([label, val]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#64748b' }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: 'monospace' }}>{formatMoney(val as number, proposal.currency)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '2px solid #1e293b', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                    <span>TOTAL</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatMoney(proposal.total, proposal.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
