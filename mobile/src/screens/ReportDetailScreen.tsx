import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Image, Modal, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WorkEntry, PhotoEntry } from '../types';
import { T } from '../theme';
import { useLang } from '../i18n';
import { parsePoint } from '../components/FormField';

const { width: SW } = Dimensions.get('window');
const PHOTO_SIZE = (SW - 48) / 2;

// ─── Field / value label maps ────────────────────────────────────────────────

const FIELD_LABELS: Record<string, { ro: string; de: string }> = {
  tip:                    { ro: 'Tip',                  de: 'Typ' },
  moment:                 { ro: 'Moment',               de: 'Zeitpunkt' },
  descriere:              { ro: 'Descriere',            de: 'Beschreibung' },
  locatie:                { ro: 'Locație',              de: 'Standort' },
  locatie_start:          { ro: 'Locație start',        de: 'Startort' },
  locatie_stop:           { ro: 'Locație stop',         de: 'Endort' },
  start:                  { ro: 'Start',                de: 'Start' },
  stop:                   { ro: 'Stop',                 de: 'Stop' },
  terasament:             { ro: 'Terasament',           de: 'Untergrund' },
  grosime_asfalt:         { ro: 'Grosime asfalt (cm)',  de: 'Asphaltdicke (cm)' },
  lungime:                { ro: 'Lungime (m)',           de: 'Länge (m)' },
  latime:                 { ro: 'Lățime (m)',            de: 'Breite (m)' },
  adancime:               { ro: 'Adâncime (m)',          de: 'Tiefe (m)' },
  nr_cabluri:             { ro: 'Nr. cabluri',           de: 'Anzahl Kabel' },
  tip_conectare:          { ro: 'Tip conectare',         de: 'Anschlussart' },
  suprafata:              { ro: 'Suprafață',             de: 'Oberfläche' },
  suprafata_mixt_detalii: { ro: 'Detalii mixt',         de: 'Mix-Details' },
  teava_protectie:        { ro: 'Țeavă protecție',       de: 'Schutzrohr' },
  lungime_totala:         { ro: 'Lungime totală (m)',    de: 'Gesamtlänge (m)' },
  nr_bransamente_ha:      { ro: 'Nr. branșamente HA',   de: 'HA-Anschlüsse' },
  nr_hp_plus:             { ro: 'Nr. HP+',              de: 'Anzahl HP+' },
};

const VALUE_LABELS: Record<string, { ro: string; de: string }> = {
  public:           { ro: 'Public',           de: 'Öffentlich' },
  privat:           { ro: 'Privat',           de: 'Privat' },
  inainte_sapatura: { ro: 'Înainte săpătură', de: 'Vor Aushub' },
  dupa_umplere:     { ro: 'După umplere',     de: 'Nach Verfüllung' },
  asfalt:           { ro: 'Asfalt',           de: 'Asphalt' },
  pavaj:            { ro: 'Pavaj',            de: 'Pflaster' },
  beton:            { ro: 'Beton',            de: 'Beton' },
  fara_strat:       { ro: 'Fără strat',       de: 'Ohne Belag' },
  mixt:             { ro: 'Mixt',             de: 'Gemischt' },
  alta:             { ro: 'Altă suprafață',   de: 'Andere Fläche' },
  kit_complet:      { ro: 'Kit complet',      de: 'Komplettset' },
  conectat_strada:  { ro: 'Conectat strada',  de: 'Straßenanschluss' },
  da:               { ro: 'Da',              de: 'Ja' },
  nu:               { ro: 'Nu',              de: 'Nein' },
  strada:           { ro: 'Stradă',          de: 'Straße' },
  trotuar:          { ro: 'Trotuar',         de: 'Gehweg' },
};

const LOCATION_KEYS = new Set(['start', 'stop', 'locatie', 'locatie_start', 'locatie_stop']);

// ─── Map helpers ─────────────────────────────────────────────────────────────

type MapPoint = { lat: number; lng: number; color: string; label?: string };

function buildMapHtml(points: MapPoint[], routePoints?: Array<{ lat: number; lng: number }>): string {
  const markersJs: string[] = [];
  const coords = points.map(p => [p.lat, p.lng]);

  points.forEach(p => {
    const tip = p.label ? `.bindTooltip('${p.label}',{permanent:true,direction:'top',offset:[0,-8]})` : '';
    markersJs.push(`L.circleMarker([${p.lat},${p.lng}],{radius:8,color:'${p.color}',fillColor:'${p.color}',fillOpacity:1,weight:2})${tip}.addTo(map);`);
  });

  if (routePoints && routePoints.length >= 2) {
    markersJs.push(`L.polyline([${routePoints.map(p => `[${p.lat},${p.lng}]`).join(',')}],{color:'#f97316',weight:3,opacity:0.9}).addTo(map);`);
  }

  const fitJs = coords.length >= 2
    ? `map.fitBounds([${coords.map(c => `[${c[0]},${c[1]}]`).join(',')}],{padding:[30,30]});`
    : coords.length === 1
    ? `map.setView([${coords[0][0]},${coords[0][1]}],16);`
    : `map.setView([48.7758,9.1829],10);`;

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0}html,body,#map{height:100%;width:100%}.leaflet-control-attribution{display:none}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:true,attributionControl:false});
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:19}).addTo(map);
${markersJs.join('\n')}
${fitJs}
</script></body></html>`;
}

function extractMapData(data: any): { points: MapPoint[]; routePoints?: Array<{ lat: number; lng: number }> } | null {
  const points: MapPoint[] = [];
  const route: Array<{ lat: number; lng: number }> = [];

  const startVal = data.start ?? data.locatie_start;
  const stopVal  = data.stop  ?? data.locatie_stop;
  const single   = data.locatie;

  if (single) {
    const p = parsePoint(String(single));
    if (p) points.push({ lat: p.lat, lng: p.lng, color: '#22c55e' });
  }
  if (startVal) {
    const p = parsePoint(String(startVal));
    if (p) { points.push({ lat: p.lat, lng: p.lng, color: '#22c55e', label: 'Start' }); route.push(p); }
  }
  if (Array.isArray(data.waypoints)) {
    (data.waypoints as string[]).forEach((w, i) => {
      const p = parsePoint(w);
      if (p) { points.push({ lat: p.lat, lng: p.lng, color: '#f97316', label: `W${i + 1}` }); route.push(p); }
    });
  }
  if (stopVal) {
    const p = parsePoint(String(stopVal));
    if (p) { points.push({ lat: p.lat, lng: p.lng, color: '#ef4444', label: 'Stop' }); route.push(p); }
  }

  if (points.length === 0) return null;
  return { points, routePoints: route.length >= 2 ? route : undefined };
}

function displayAddress(v: string): string {
  const idx = v.lastIndexOf('|');
  return (idx >= 0 ? v.slice(0, idx) : v).trim();
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  entry: WorkEntry;
  onBack: () => void;
}

const SKIP_KEYS = new Set(['photos', 'waypoints']);

export default function ReportDetailScreen({ entry, onBack }: Props) {
  const { lang, tr } = useLang();
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const data = entry.data as any;
  const photos: PhotoEntry[] = data?.photos ?? [];
  const mapData = extractMapData(data);

  const d = new Date(entry.created_at);
  const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  const fields = Object.entries(data ?? {}).filter(([k, v]) =>
    !SKIP_KEYS.has(k) && v !== '' && v !== null && v !== undefined
  );

  const getLabel = (key: string) => {
    const obj = FIELD_LABELS[key];
    return obj ? (lang === 'de' ? obj.de : obj.ro) : key;
  };

  const getValue = (key: string, val: unknown): string => {
    const str = String(val);
    if (LOCATION_KEYS.has(key)) return displayAddress(str) || str;
    const obj = VALUE_LABELS[str];
    return obj ? (lang === 'de' ? obj.de : obj.ro) : str;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>{tr.back.replace('‹ ', '')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{tr.workTypeLabels[entry.work_type]}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{entry.site_name}{entry.nvt_number ? ` — ${entry.nvt_number}` : ''}</Text>
        </View>
        <View style={[styles.syncBadge, entry.synced ? styles.syncDone : styles.syncPending]}>
          <Text style={[styles.syncText, entry.synced ? styles.syncTextDone : styles.syncTextPending]}>
            {entry.synced ? '✓ Sync' : 'Pending'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Meta */}
        <View style={styles.card}>
          <Text style={styles.metaDate}>{dateStr}</Text>
          <Text style={styles.metaUser}>{entry.created_by_name}</Text>
        </View>

        {/* Map */}
        {mapData && (
          <View style={styles.mapCard}>
            <WebView
              source={{ html: buildMapHtml(mapData.points, mapData.routePoints) }}
              style={styles.map}
              scrollEnabled={false}
              javaScriptEnabled
            />
          </View>
        )}

        {/* Data fields */}
        {fields.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{lang === 'de' ? 'Daten' : 'Date raport'}</Text>
            {fields.map(([key, val], idx) => (
              <View key={key} style={[styles.fieldRow, idx === fields.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.fieldKey}>{getLabel(key)}</Text>
                <Text style={styles.fieldVal} numberOfLines={2}>{getValue(key, val)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{lang === 'de' ? `Fotos (${photos.length})` : `Fotografii (${photos.length})`}</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, idx) => {
                const uri = photo.remote_url ?? photo.uri;
                return (
                  <TouchableOpacity key={idx} onPress={() => setLightboxUri(uri)} activeOpacity={0.85}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                    {photo.category ? (
                      <View style={styles.photoCat}>
                        <Text style={styles.photoCatText} numberOfLines={1}>{photo.category}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <View style={styles.lightbox}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setLightboxUri(null)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          {lightboxUri ? <Image source={{ uri: lightboxUri }} style={styles.lightboxImg} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.dark, paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: T.borderDk,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 },
  backArrow: { color: T.green, fontSize: 16 },
  backText: { color: T.green, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: T.textLight, fontSize: 15, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 },
  syncBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  syncDone: { backgroundColor: T.greenDim },
  syncPending: { backgroundColor: 'rgba(245,158,11,0.15)' },
  syncText: { fontSize: 11, fontWeight: '700' },
  syncTextDone: { color: T.green },
  syncTextPending: { color: T.warning },

  scroll: { padding: 14, paddingBottom: 40, gap: 12 },

  card: {
    backgroundColor: T.surface, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: T.border,
  },
  metaDate: { fontSize: 14, fontWeight: '700', color: T.text },
  metaUser: { fontSize: 12, color: T.text2, marginTop: 3 },

  mapCard: {
    height: 200, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: T.border,
  },
  map: { flex: 1 },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: T.text3,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  fieldKey: { fontSize: 13, color: T.text2, flex: 1 },
  fieldVal: { fontSize: 13, color: T.text, fontWeight: '600', flex: 1, textAlign: 'right' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 8, backgroundColor: T.border },
  photoCat: {
    position: 'absolute', bottom: 4, left: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },
  photoCatText: { color: '#fff', fontSize: 9, fontWeight: '600', textAlign: 'center' },

  lightbox: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeBtn: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lightboxImg: { width: SW, height: SW * 1.3 },
});
