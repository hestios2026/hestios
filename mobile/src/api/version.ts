import axios from 'axios';
import { BASE_URL } from './client';

export interface MobileVersion {
  mobile_version_code: string;
  mobile_version_name: string;
  mobile_download_url: string;
}

export async function fetchMobileVersion(): Promise<MobileVersion> {
  const res = await axios.get<MobileVersion>(`${BASE_URL}/settings/mobile-version/`, {
    timeout: 8000,
  });
  return res.data;
}
