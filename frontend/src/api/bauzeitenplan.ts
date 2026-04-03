import client from './client';

export interface BzpWeekly {
  id: number;
  row_id: number;
  week_date: string;
  meters: number;
  note: string | null;
}

export interface BzpRow {
  id: number;
  project_id: number;
  vorhaben_nr: string | null;
  hk_nvt: string | null;
  gewerk: string | null;
  hh: boolean;
  hc: boolean;
  tb_soll_m: number | null;
  date_start: string | null;
  date_end: string | null;
  tb_ist_m: number;
  ha_gebaut: number;
  verzug_kw: number;
  bemerkung: string | null;
  sort_order: number;
  is_group_header: boolean;
  color: string | null;
  progress_pct: number;
  weekly: BzpWeekly[];
}

export interface BzpProject {
  id: number;
  site_id: number;
  name: string;
  firma: string | null;
  baubeginn: string | null;
  bauende: string | null;
  site_name: string | null;
  rows?: BzpRow[];
}

export const bzpApi = {
  listProjects: (site_id?: number) =>
    client.get('/bauzeitenplan/projects/', { params: site_id ? { site_id } : {} }).then(r => r.data as BzpProject[]),

  getProject: (id: number) =>
    client.get(`/bauzeitenplan/projects/${id}/`).then(r => r.data as BzpProject),

  createProject: (data: Partial<BzpProject>) =>
    client.post('/bauzeitenplan/projects/', data).then(r => r.data as BzpProject),

  updateProject: (id: number, data: Partial<BzpProject>) =>
    client.put(`/bauzeitenplan/projects/${id}/`, data).then(r => r.data as BzpProject),

  deleteProject: (id: number) =>
    client.delete(`/bauzeitenplan/projects/${id}/`),

  addRow: (project_id: number, data: Partial<BzpRow>) =>
    client.post(`/bauzeitenplan/projects/${project_id}/rows/`, data).then(r => r.data as BzpRow),

  updateRow: (row_id: number, data: Partial<BzpRow>) =>
    client.put(`/bauzeitenplan/rows/${row_id}/`, data).then(r => r.data as BzpRow),

  deleteRow: (row_id: number) =>
    client.delete(`/bauzeitenplan/rows/${row_id}/`),

  upsertWeekly: (row_id: number, week_date: string, meters: number, note?: string) =>
    client.put(`/bauzeitenplan/rows/${row_id}/weekly/`, { week_date, meters, note }).then(r => r.data as BzpRow),

  exportExcel: (project_id: number) =>
    `${client.defaults.baseURL}/bauzeitenplan/projects/${project_id}/export/excel/`,

  exportPdf: (project_id: number) =>
    `${client.defaults.baseURL}/bauzeitenplan/projects/${project_id}/export/pdf/`,
};
