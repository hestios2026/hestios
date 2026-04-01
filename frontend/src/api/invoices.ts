import api from './client';

export interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface InvoiceProposal {
  supplier_name: string;
  invoice_nr: string;
  invoice_date: string | null;
  due_date: string | null;
  line_items: LineItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency: string;
  notes: string;
  file_key?: string;
  original_filename?: string;
}

export const scanInvoice = (file: File): Promise<InvoiceProposal> => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/invoices/scan/', fd).then(r => r.data);
};

export const confirmInvoice = (proposal: InvoiceProposal, site_id: number, category: string, save_document: boolean) =>
  api.post('/invoices/confirm/', { proposal, site_id, category, save_document }).then(r => r.data);
