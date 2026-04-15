/**
 * LocationPicker — Leaflet.js map via WebView, no Google Maps API key needed.
 *
 * Usage:
 *   <LocationPicker mode="single" onConfirm={result => ...} onClose={() => ...} />
 *   <LocationPicker mode="route"  onConfirm={result => ...} onClose={() => ...} />
 *
 * Returns: { start: { lat, lng }, stop?: { lat, lng } }
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

export interface LocationPoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface LocationResult {
  start: LocationPoint;
  stop?: LocationPoint;
}

interface Props {
  mode: 'single' | 'route';
  initialStart?: LocationPoint;
  initialStop?: LocationPoint;
  onConfirm: (result: LocationResult) => void;
  onClose: () => void;
}

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────

function buildHtml(
  mode: 'single' | 'route',
  initialStart?: LocationPoint,
  initialStop?: LocationPoint,
): string {
  const startJson = initialStart ? JSON.stringify(initialStart) : 'null';
  const stopJson  = initialStop  ? JSON.stringify(initialStop)  : 'null';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { height: 100%; width: 100%; }
  body { background: #0f172a; }
  .leaflet-control-attribution { display: none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var mode = ${JSON.stringify(mode)};
  var placing = 'start';
  var startMarker = null, stopMarker = null, polyline = null;

  var map = L.map('map', { zoomControl: true }).setView([48.7758, 9.1829], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  var greenIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
    iconSize: [14,14], iconAnchor: [7,7], className: ''
  });
  var redIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
    iconSize: [14,14], iconAnchor: [7,7], className: ''
  });

  function postUpdate() {
    var msg = {
      type: 'update',
      start: startMarker ? { lat: startMarker.getLatLng().lat, lng: startMarker.getLatLng().lng } : null,
      stop:  stopMarker  ? { lat: stopMarker.getLatLng().lat,  lng: stopMarker.getLatLng().lng  } : null,
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function updatePolyline() {
    if (polyline) { map.removeLayer(polyline); polyline = null; }
    if (startMarker && stopMarker) {
      polyline = L.polyline([startMarker.getLatLng(), stopMarker.getLatLng()], {
        color: '#f97316', weight: 3, opacity: 0.9
      }).addTo(map);
    }
    postUpdate();
  }

  function placeStart(latlng) {
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker(latlng, { icon: greenIcon, draggable: true }).addTo(map);
    startMarker.on('dragend', function() { updatePolyline(); });
    updatePolyline();
  }

  function placeStop(latlng) {
    if (stopMarker) map.removeLayer(stopMarker);
    stopMarker = L.marker(latlng, { icon: redIcon, draggable: true }).addTo(map);
    stopMarker.on('dragend', function() { updatePolyline(); });
    updatePolyline();
  }

  map.on('click', function(e) {
    if (mode === 'single') {
      placeStart(e.latlng);
    } else {
      if (placing === 'start') {
        placeStart(e.latlng);
        placing = 'stop';
      } else {
        placeStop(e.latlng);
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'placing', placing: placing }));
    }
  });

  // Listen for messages from React Native
  document.addEventListener('message', handleMsg);
  window.addEventListener('message', handleMsg);
  function handleMsg(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'setPlacing') placing = msg.placing;
      if (msg.type === 'flyTo') map.flyTo([msg.lat, msg.lng], 16);
    } catch(e) {}
  }

  // Restore initial values
  var initStart = ${startJson};
  var initStop  = ${stopJson};
  if (initStart) { placeStart(L.latLng(initStart.lat, initStart.lng)); map.setView([initStart.lat, initStart.lng], 16); }
  if (initStop && mode === 'route') { placeStop(L.latLng(initStop.lat, initStop.lng)); }
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationPicker({ mode, initialStart, initialStop, onConfirm, onClose }: Props) {
  const webRef = useRef<WebView>(null);
  const [start, setStart] = useState<LocationPoint | null>(initialStart ?? null);
  const [stop,  setStop]  = useState<LocationPoint | null>(initialStop  ?? null);
  const [placing, setPlacing]   = useState<'start' | 'stop'>('start');
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);

  const html = buildHtml(mode, initialStart, initialStop);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'update') {
        setStart(msg.start);
        setStop(msg.stop);
      } else if (msg.type === 'placing') {
        setPlacing(msg.placing);
      }
    } catch {}
  };

  const setPlacingMode = (p: 'start' | 'stop') => {
    setPlacing(p);
    webRef.current?.postMessage(JSON.stringify({ type: 'setPlacing', placing: p }));
  };

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permisiune locație necesară'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      webRef.current?.postMessage(JSON.stringify({
        type: 'flyTo',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      }));
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut obține locația.');
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = () => {
    if (!start) { Alert.alert('Plasează cel puțin un pin pe hartă'); return; }
    if (mode === 'route' && !stop) { Alert.alert('Plasează și pinul Stop'); return; }
    onConfirm({ start, stop: stop ?? undefined });
  };

  const fmt = (p: LocationPoint | null) =>
    p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'single' ? 'Selectează locație' : 'Traseu Start → Stop'}
          </Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
            <Text style={styles.confirmTxt}>Confirmă</Text>
          </TouchableOpacity>
        </View>

        {/* Mode selector (route only) */}
        {mode === 'route' && (
          <View style={styles.modebar}>
            <TouchableOpacity
              style={[styles.modeBtn, placing === 'start' && styles.modeBtnActive]}
              onPress={() => setPlacingMode('start')}
            >
              <View style={[styles.pinDot, { backgroundColor: '#22c55e' }]} />
              <Text style={[styles.modeTxt, placing === 'start' && styles.modeTxtActive]}>
                Start{start ? ' ✓' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, placing === 'stop' && styles.modeBtnActive]}
              onPress={() => setPlacingMode('stop')}
            >
              <View style={[styles.pinDot, { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.modeTxt, placing === 'stop' && styles.modeTxtActive]}>
                Stop{stop ? ' ✓' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Map (WebView) */}
        <View style={styles.mapContainer}>
          {!mapReady && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#22c55e" size="large" />
              <Text style={styles.loadingTxt}>Se încarcă harta...</Text>
            </View>
          )}
          <WebView
            ref={webRef}
            source={{ html }}
            style={styles.map}
            onLoadEnd={() => setMapReady(true)}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
          />

          {/* GPS button overlay */}
          <TouchableOpacity style={styles.gpsBtn} onPress={goToMyLocation} disabled={locating}>
            {locating
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.gpsTxt}>📍 Locația mea</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Coordinates display */}
        <View style={styles.coordBar}>
          {start ? (
            <Text style={styles.coordTxt}>
              <Text style={{ color: '#22c55e', fontWeight: '700' }}>S: </Text>
              {fmt(start)}
            </Text>
          ) : (
            <Text style={styles.coordHint}>
              {mode === 'route' ? 'Apasă pe hartă → pin Start' : 'Apasă pe hartă pentru locație'}
            </Text>
          )}
          {mode === 'route' && stop && (
            <Text style={[styles.coordTxt, { marginTop: 2 }]}>
              <Text style={{ color: '#ef4444', fontWeight: '700' }}>E: </Text>
              {fmt(stop)}
            </Text>
          )}
        </View>
        <Text style={styles.hint}>
          {mode === 'route' ? 'Pinii sunt draggable după plasare' : 'Pinul e draggable după plasare'}
        </Text>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: '#0F172A',
  },
  closeBtn: { padding: 6 },
  closeTxt: { color: '#94A3B8', fontSize: 18 },
  title: { color: '#F1F5F9', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#F97316', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  confirmTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modebar: {
    flexDirection: 'row', backgroundColor: '#1E293B',
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  modeBtnActive: { borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.1)' },
  pinDot: { width: 10, height: 10, borderRadius: 5 },
  modeTxt: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  modeTxtActive: { color: '#F97316' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1, backgroundColor: '#1E293B' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: 12,
  },
  loadingTxt: { color: '#64748B', fontSize: 13 },
  gpsBtn: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#334155', elevation: 4,
  },
  gpsTxt: { color: '#F1F5F9', fontSize: 13, fontWeight: '600' },
  coordBar: { backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 10 },
  coordTxt: { fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' },
  coordHint: { fontSize: 12, color: '#475569', textAlign: 'center' },
  hint: { backgroundColor: '#1E293B', textAlign: 'center', color: '#334155', fontSize: 11, paddingBottom: 8 },
});
