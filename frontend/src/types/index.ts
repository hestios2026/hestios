export type UserRole = 'director' | 'projekt_leiter' | 'polier' | 'sef_santier' | 'callcenter' | 'aufmass';
export type Lang = 'ro' | 'de' | 'en';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  language: Lang;
  permissions?: Record<string, boolean>;
}

export interface Site {
  id: number;
  kostenstelle: string;
  name: string;
  client: string;
  address?: string;
  status: 'active' | 'paused' | 'finished';
  is_baustelle: boolean;
  budget: number;
  total_costs: number;
  manager_id?: number;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

export interface Cost {
  id: number;
  category: string;
  description: string;
  amount: number;
  currency: string;
  invoice_ref?: string;
  supplier?: string;
  date: string;
  notes?: string;
}

export interface Supplier {
  id: number;
  name: string;
  email: string;
  email2?: string;
  phone?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  prices?: SupplierPrice[];
}

export interface SupplierPrice {
  id: number;
  supplier_id: number;
  product_name: string;
  unit: string;
  price: number;
  currency: string;
  valid_from?: string;
  valid_until?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  supplier_id: number;
  supplier_name?: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  email_sent: boolean;
}

export interface PurchaseOrder {
  id: number;
  site_id?: number;
  site_name?: string;
  requested_by?: number;
  requester_name?: string;
  status: 'pending' | 'approved' | 'sent' | 'cancelled';
  total_amount: number;
  notes?: string;
  created_at: string;
  approved_at?: string;
  items: OrderItem[];
}

export interface Document {
  id: number;
  name: string;
  description?: string;
  category: string;
  site_id?: number;
  site_name?: string;
  employee_id?: number;
  employee_name?: string;
  equipment_id?: number;
  equipment_name?: string;
  folder_id?: number;
  folder_name?: string;
  file_key: string;
  file_size: number;
  content_type: string;
  uploaded_by?: number;
  uploader_name?: string;
  created_at: string;
  notes?: string;
  download_url?: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  position: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  aufmass_id?: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  site_id?: number;
  site_name?: string;
  site_kostenstelle?: string;
  client_name: string;
  client_address?: string;
  client_email?: string;
  issue_date: string;
  due_date?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  payment_ref?: string;
  notes?: string;
  creator_name?: string;
  created_at: string;
  paid_at?: string;
  items?: InvoiceItem[];
}

export interface AufmassEntry {
  id: number;
  site_id: number;
  site_name?: string;
  site_kostenstelle?: string;
  date: string;
  position: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  recorded_by?: number;
  recorder_name?: string;
  status: 'draft' | 'submitted' | 'approved';
  notes?: string;
  created_at: string;
}

export interface MaterialLog {
  id: number;
  material: string;
  quantity: number;
  unit: string;
  date: string;
  notes?: string;
}
