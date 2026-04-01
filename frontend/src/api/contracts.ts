import client from './client';

export const downloadArbeitsvertrag = async (employeeId: number, filename: string) => {
  const res = await client.get(`/contracts/${employeeId}/arbeitsvertrag/`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
