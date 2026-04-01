import api from './client';

export interface TeamWorker {
  employee_id: number;
  employee_name: string;
}

export interface PontajWorkerPayload {
  employee_id: number;
  present: boolean;
  ora_start?: string;
  ora_stop?: string;
}

export interface PontajPayload {
  local_uuid: string;
  date: string;
  site_id: number;
  workers: PontajWorkerPayload[];
}

export const fetchMyTeam = async (): Promise<TeamWorker[]> => {
  const res = await api.get('/timesheets/my-team/');
  return res.data;
};

export const submitPontaj = async (payload: PontajPayload): Promise<void> => {
  await api.post('/timesheets/pontaj/', payload);
};
