import client from './client';

export const fetchTimeEntries = (params: Record<string, unknown> = {}) =>
  client.get('/timesheets/entries/', { params }).then(r => r.data);

export const upsertTimeEntry = (data: Record<string, unknown>) =>
  client.post('/timesheets/entries/', data).then(r => r.data);

export const updateTimeEntry = (id: number, data: Record<string, unknown>) =>
  client.put(`/timesheets/entries/${id}/`, data).then(r => r.data);

export const deleteTimeEntry = (id: number) =>
  client.delete(`/timesheets/entries/${id}/`).then(r => r.data);

export const fetchWeeklySummary = (week: number, year: number) =>
  client.get('/timesheets/weekly-summary/', { params: { week, year } }).then(r => r.data);

export const importTimesheetExcel = (file: File, week: number, year: number) => {
  const fd = new FormData();
  fd.append('file', file);
  return client.post('/timesheets/import/', fd, { params: { week, year }, headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

export const fetchLeaves = (params: Record<string, unknown> = {}) =>
  client.get('/timesheets/leaves/', { params }).then(r => r.data);

export const createLeave = (data: Record<string, unknown>) =>
  client.post('/timesheets/leaves/', data).then(r => r.data);

export const approveLeave = (id: number) =>
  client.post(`/timesheets/leaves/${id}/approve/`).then(r => r.data);

export const rejectLeave = (id: number) =>
  client.post(`/timesheets/leaves/${id}/reject/`).then(r => r.data);

export const fetchPayroll = (year: number, month: number) =>
  client.get('/timesheets/payroll/', { params: { year, month } }).then(r => r.data);

export const calculatePayroll = (year: number, month: number) =>
  client.post('/timesheets/payroll/calculate/', { year, month }).then(r => r.data);

export const lockPayroll = (id: number) =>
  client.post(`/timesheets/payroll/${id}/lock/`).then(r => r.data);

export const downloadDatevExport = async (year: number, month: number) => {
  const res = await client.get('/timesheets/payroll/datev-export/', {
    params: { year, month },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `DATEV_Lohn_${year}_${String(month).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const fetchTeamAssignments = (team_lead_id?: number) =>
  client.get('/timesheets/team-assignments/', { params: team_lead_id ? { team_lead_id } : {} }).then(r => r.data);

export const setTeamAssignments = (team_lead_id: number, employee_ids: number[]) =>
  client.put(`/timesheets/team-assignments/${team_lead_id}/`, { employee_ids }).then(r => r.data);

export const fetchPontaj = (params: Record<string, unknown> = {}) =>
  client.get('/timesheets/pontaj/', { params }).then(r => r.data);
