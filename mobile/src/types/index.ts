// Auth
export interface AuthUser {
  id: number;
  full_name: string;
  role: string;
  pin: string;
}

// Kostenstelle / Site
export interface Site {
  id: number;
  name: string;
  kst: string;
}

// Photo attachment
export interface PhotoEntry {
  uri: string;          // local URI (or remote URL after upload)
  category: string;
  uploaded: boolean;
  remote_url?: string;
}

// Base work entry
export interface WorkEntry {
  id: string;           // local UUID
  remote_id?: number;   // set after sync
  site_id: number;
  site_name: string;
  nvt_number: string;
  work_type: WorkType;
  created_by: number;
  created_by_name: string;
  created_at: string;   // ISO
  synced: boolean;
  data: WorkData;       // type-specific payload
}

export type WorkType =
  | 'poze_inainte'
  | 'teratest'
  | 'semne_circulatie'
  | 'liefer_scheine'
  | 'montaj_nvt_pdp'
  | 'hp_plus'
  | 'ha'
  | 'reparatie'
  | 'tras_teava'
  | 'groapa'
  | 'traversare'
  | 'sapatura'
  | 'raport_zilnic';

// ─── Work type specific data ──────────────────────────────────────────────────

export interface DataPozeInainte {
  tip: 'public' | 'privat' | '';
  start: string;
  stop: string;
  waypoints?: string[];
  photos: PhotoEntry[];
}

export interface DataTeratest {
  moment: 'inainte_sapatura' | 'dupa_umplere' | '';
  photos: PhotoEntry[];
}

export interface DataSemneCirculatie {
  start: string;
  stop: string;
  waypoints?: string[];
  photos: PhotoEntry[];
}

export interface DataLieferScheine {
  descriere: string;
  photos: PhotoEntry[];
}

export interface DataMontajNvtPdp {
  locatie: string;
  photos: PhotoEntry[];
}

export interface DataHpPlus {
  locatie: string;
  photos: PhotoEntry[];
}

export interface DataHA {
  locatie: string;
  tip_conectare: 'kit_complet' | 'conectat_strada' | '';
  suprafata: 'asfalt' | 'pavaj' | 'beton' | 'fara_strat' | 'mixt' | '';
  suprafata_mixt_detalii: string;
  photos: PhotoEntry[];
}

export interface DataReparatie {
  locatie: string;
  descriere: string;
  photos: PhotoEntry[];
}

export interface DataTrasTeava {
  start: string;
  stop: string;
  waypoints?: string[];
  nr_cabluri: string;
  lungime: string;
  photos: PhotoEntry[];
}

export interface DataGroapa {
  locatie: string;
  terasament: 'asfalt' | 'pavaj' | 'alta' | '';
  grosime_asfalt: string;
  lungime: string;
  latime: string;
  adancime: string;
  photos: PhotoEntry[];
}

export interface DataTraversare {
  start: string;
  stop: string;
  waypoints?: string[];
  lungime: string;
  latime: string;
  adancime: string;
  terasament: 'asfalt' | 'alta' | '';
  grosime_asfalt: string;
  nr_cabluri: string;
  teava_protectie: 'da' | 'nu' | '';
  photos: PhotoEntry[];
}

export interface DataSapatura {
  start: string;
  stop: string;
  waypoints?: string[];
  terasament: 'asfalt' | 'alta' | '';
  grosime_asfalt: string;
  lungime: string;
  latime: string;
  adancime: string;
  tip: 'strada' | 'trotuar' | 'privat' | '';
  nr_cabluri: string;
  photos: PhotoEntry[];
}

export interface DataRaportZilnic {
  lungime_totala: string;
  nr_bransamente_ha: string;
  nr_hp_plus: string;
  locatie_start: string;
  locatie_stop: string;
  photos: PhotoEntry[];
}

export type WorkData =
  | DataPozeInainte
  | DataTeratest
  | DataSemneCirculatie
  | DataLieferScheine
  | DataMontajNvtPdp
  | DataHpPlus
  | DataHA
  | DataReparatie
  | DataTrasTeava
  | DataGroapa
  | DataTraversare
  | DataSapatura
  | DataRaportZilnic;

// Photo categories
export const PHOTO_CATEGORIES = [
  'Dovezi', 'Dimensiuni', 'Acte', 'HA', 'HP+',
  'Săpătură', 'Grosime Asfalt', 'Altele',
];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  poze_inainte:     'Poze Înainte',
  teratest:         'Teratest',
  semne_circulatie: 'Semne Circulație',
  liefer_scheine:   'Liefer Scheine',
  montaj_nvt_pdp:   'Montaj NVT / PDP / MFG',
  hp_plus:          'HP+',
  ha:               'HA',
  reparatie:        'Reparație',
  tras_teava:       'Tras Țeavă',
  groapa:           'Groapă',
  traversare:       'Traversare',
  sapatura:         'Săpătură',
  raport_zilnic:    'Raport Zilnic',
};
