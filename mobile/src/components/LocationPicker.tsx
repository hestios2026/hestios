/**
 * LocationPicker — Leaflet.js map via WebView, no Google Maps API key needed.
 *
 * Features:
 *  - Reverse geocoding via Nominatim (shows street name + number)
 *  - Single / route mode
 *  - Route mode supports intermediate waypoints
 *  - All markers are draggable
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useLang } from '../i18n';

export interface LocationPoint {
  lat: number;
  lng: number;
  label?: string; // street name + number from reverse geocode
}

export interface LocationResult {
  start: LocationPoint;
  stop?: LocationPoint;
  waypoints?: LocationPoint[];
}

interface Props {
  mode: 'single' | 'route';
  initialStart?: LocationPoint;
  initialStop?: LocationPoint;
  initialWaypoints?: LocationPoint[];
  onConfirm: (result: LocationResult) => void;
  onClose: () => void;
}

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────

function buildHtml(
  mode: 'single' | 'route',
  initialStart?: LocationPoint,
  initialStop?: LocationPoint,
  initialWaypoints?: LocationPoint[],
): string {
  const startJson = initialStart ? JSON.stringify(initialStart) : 'null';
  const stopJson  = initialStop  ? JSON.stringify(initialStop)  : 'null';
  const wpJson    = initialWaypoints ? JSON.stringify(initialWaypoints) : '[]';

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
  var startLabel = '', stopLabel = '';
  var waypoints = []; // [{marker, label}]

  var map = L.map('map', { zoomControl: true }).setView([48.7758, 9.1829], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19
  }).addTo(map);

  function makeIcon(color) {
    return L.divIcon({
      html: '<div style="width:14px;height:14px;border-radius:50%;background:'+color+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>',
      iconSize:[14,14], iconAnchor:[7,7], className:''
    });
  }
  function makeWpIcon(n) {
    return L.divIcon({
      html: '<div style="width:13px;height:13px;border-radius:50%;background:#f97316;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center"><span style=\\"font-size:7px;color:#fff;font-weight:bold;\\">'+n+'</span></div>',
      iconSize:[13,13], iconAnchor:[6,6], className:''
    });
  }
  var greenIcon = makeIcon('#22c55e');
  var redIcon   = makeIcon('#ef4444');

  function reverseGeocode(latlng, cb) {
    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+latlng.lat+'&lon='+latlng.lng+'&accept-language=de,ro')
      .then(function(r){ return r.json(); })
      .then(function(d) {
        var addr = d.address || {};
        var parts = [];
        if (addr.road || addr.pedestrian || addr.footway) parts.push(addr.road || addr.pedestrian || addr.footway);
        if (addr.house_number) parts.push(addr.house_number);
        cb(parts.join(' ') || '');
      })
      .catch(function(){ cb(''); });
  }

  function postUpdate() {
    var msg = {
      type: 'update',
      start: startMarker ? { lat: startMarker.getLatLng().lat, lng: startMarker.getLatLng().lng, label: startLabel } : null,
      stop:  stopMarker  ? { lat: stopMarker.getLatLng().lat,  lng: stopMarker.getLatLng().lng,  label: stopLabel  } : null,
      waypoints: waypoints.map(function(w) {
        return { lat: w.marker.getLatLng().lat, lng: w.marker.getLatLng().lng, label: w.label };
      }),
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function updatePolyline() {
    if (polyline) { map.removeLayer(polyline); polyline = null; }
    var pts = [];
    if (startMarker) pts.push(startMarker.getLatLng());
    waypoints.forEach(function(w){ pts.push(w.marker.getLatLng()); });
    if (stopMarker) pts.push(stopMarker.getLatLng());
    if (pts.length >= 2) {
      polyline = L.polyline(pts, { color: '#f97316', weight: 3, opacity: 0.9 }).addTo(map);
    }
    postUpdate();
  }

  function rebuildWpIcons() {
    waypoints.forEach(function(w, i) {
      w.marker.setIcon(makeWpIcon(i + 1));
    });
  }

  function placeStart(latlng) {
    if (startMarker) map.removeLayer(startMarker);
    startLabel = '';
    startMarker = L.marker(latlng, { icon: greenIcon, draggable: true }).addTo(map);
    startMarker.on('dragend', function() {
      startLabel = '';
      reverseGeocode(startMarker.getLatLng(), function(lbl){ startLabel = lbl; updatePolyline(); });
      updatePolyline();
    });
    reverseGeocode(latlng, function(lbl){ startLabel = lbl; updatePolyline(); });
    updatePolyline();
  }

  function placeStop(latlng) {
    if (stopMarker) map.removeLayer(stopMarker);
    stopLabel = '';
    stopMarker = L.marker(latlng, { icon: redIcon, draggable: true }).addTo(map);
    stopMarker.on('dragend', function() {
      stopLabel = '';
      reverseGeocode(stopMarker.getLatLng(), function(lbl){ stopLabel = lbl; updatePolyline(); });
      updatePolyline();
    });
    reverseGeocode(latlng, function(lbl){ stopLabel = lbl; updatePolyline(); });
    updatePolyline();
  }

  function addWaypoint(latlng) {
    var idx = waypoints.length;
    var marker = L.marker(latlng, { icon: makeWpIcon(idx + 1), draggable: true }).addTo(map);
    var wp = { marker: marker, label: '' };
    waypoints.push(wp);
    rebuildWpIcons();
    marker.on('dragend', function() {
      wp.label = '';
      reverseGeocode(marker.getLatLng(), function(lbl){ wp.label = lbl; updatePolyline(); });
      updatePolyline();
    });
    reverseGeocode(latlng, function(lbl){ wp.label = lbl; updatePolyline(); });
    updatePolyline();
  }

  function removeWaypoint(idx) {
    if (waypoints[idx]) {
      map.removeLayer(waypoints[idx].marker);
      waypoints.splice(idx, 1);
      rebuildWpIcons();
      updatePolyline();
    }
  }

  map.on('click', function(e) {
    if (mode === 'single') {
      placeStart(e.latlng);
    } else if (placing === 'start') {
      placeStart(e.latlng);
      placing = 'stop';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'placing', placing: 'stop' }));
    } else if (placing === 'stop') {
      placeStop(e.latlng);
    } else if (placing === 'waypoint') {
      addWaypoint(e.latlng);
    }
  });

  document.addEventListener('message', handleMsg);
  window.addEventListener('message', handleMsg);
  function handleMsg(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'setPlacing') { placing = msg.placing; }
      if (msg.type === 'flyTo') { map.flyTo([msg.lat, msg.lng], 16); }
      if (msg.type === 'removeWaypoint') { removeWaypoint(msg.index); }
    } catch(err) {}
  }

  // Restore initial values
  var initStart = ${startJson};
  var initStop  = ${stopJson};
  var initWps   = ${wpJson};
  if (initStart) {
    startLabel = initStart.label || '';
    placeStart(L.latLng(initStart.lat, initStart.lng));
    map.setView([initStart.lat, initStart.lng], 16);
  }
  if (initStop && mode === 'route') {
    stopLabel = initStop.label || '';
    placeStop(L.latLng(initStop.lat, initStop.lng));
  }
  if (initWps && mode === 'route') {
    initWps.forEach(function(wp) { addWaypoint(L.latLng(wp.lat, wp.lng)); });
  }
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocationPicker({
  mode, initialStart, initialStop, initialWaypoints, onConfirm, onClose,
}: Props) {
  const { tr } = useLang();
  const webRef = useRef<WebView>(null);
  const [start, setStart] = useState<LocationPoint | null>(initialStart ?? null);
  const [stop, setStop]   = useState<LocationPoint | null>(initialStop  ?? null);
  const [waypoints, setWaypoints] = useState<LocationPoint[]>(initialWaypoints ?? []);
  const [placing, setPlacing]     = useState<'start' | 'stop' | 'waypoint'>('start');
  const [mapReady, setMapReady]   = useState(false);
  const [locating, setLocating]   = useState(false);

  const html = buildHtml(mode, initialStart, initialStop, initialWaypoints);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'update') {
        setStart(msg.start);
        setStop(msg.stop);
        setWaypoints(msg.waypoints ?? []);
      } else if (msg.type === 'placing') {
        setPlacing(msg.placing);
      }
    } catch {}
  };

  const setPlacingMode = (p: 'start' | 'stop' | 'waypoint') => {
    setPlacing(p);
    webRef.current?.postMessage(JSON.stringify({ type: 'setPlacing', placing: p }));
  };

  const removeWaypoint = (idx: number) => {
    webRef.current?.postMessage(JSON.stringify({ type: 'removeWaypoint', index: idx }));
  };

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert(tr.locationPermission); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      webRef.current?.postMessage(JSON.stringify({
        type: 'flyTo',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      }));
    } catch {
      Alert.alert(tr.errorTitle, tr.locationError);
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = () => {
    if (!start) { Alert.alert(tr.placeStartPin); return; }
    if (mode === 'route' && !stop) { Alert.alert(tr.placeStopPin); return; }
    onConfirm({ start, stop: stop ?? undefined, waypoints: waypoints.length > 0 ? waypoints : undefined });
  };

  const fmtCoords = (p: LocationPoint) =>
    `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

  const fmtLabel = (p: LocationPoint) =>
    p.label ? p.label : fmtCoords(p);

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {mode === 'single' ? tr.mapTitleSingle : tr.mapTitleRoute}
          </Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
            <Text style={styles.confirmTxt}>{tr.confirmMap}</Text>
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

            <TouchableOpacity
              style={[styles.modeBtn, placing === 'waypoint' && styles.modeBtnWaypoint]}
              onPress={() => setPlacingMode('waypoint')}
            >
              <View style={[styles.pinDot, { backgroundColor: '#f97316' }]} />
              <Text style={[styles.modeTxt, placing === 'waypoint' && styles.modeTxtWaypoint]}>
                {tr.addWaypoint}{waypoints.length > 0 ? ` (${waypoints.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Map */}
        <View style={styles.mapContainer}>
          {!mapReady && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#22c55e" size="large" />
              <Text style={styles.loadingTxt}>{tr.mapLoadingTxt}</Text>
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
          <TouchableOpacity style={styles.gpsBtn} onPress={goToMyLocation} disabled={locating}>
            {locating
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.gpsTxt}>📍 {tr.myLocation}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Points summary */}
        <ScrollView style={styles.coordBar} scrollEnabled={waypoints.length > 2}>
          {start ? (
            <View style={styles.coordRow}>
              <View style={[styles.coordDot, { backgroundColor: '#22c55e' }]} />
              <View style={styles.coordTexts}>
                <Text style={styles.coordLabel}>{fmtLabel(start)}</Text>
                {start.label ? <Text style={styles.coordCoords}>{fmtCoords(start)}</Text> : null}
              </View>
            </View>
          ) : (
            <Text style={styles.coordHint}>
              {mode === 'route' ? tr.pinHintRoute : tr.pinHintSingle}
            </Text>
          )}

          {waypoints.map((wp, idx) => (
            <View key={idx} style={styles.coordRow}>
              <View style={[styles.coordDot, { backgroundColor: '#f97316' }]} />
              <View style={styles.coordTexts}>
                <Text style={styles.coordLabel}>{fmtLabel(wp)}</Text>
                {wp.label ? <Text style={styles.coordCoords}>{fmtCoords(wp)}</Text> : null}
              </View>
              <TouchableOpacity style={styles.removeWpBtn} onPress={() => removeWaypoint(idx)}>
                <Text style={styles.removeWpTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {mode === 'route' && stop && (
            <View style={styles.coordRow}>
              <View style={[styles.coordDot, { backgroundColor: '#ef4444' }]} />
              <View style={styles.coordTexts}>
                <Text style={styles.coordLabel}>{fmtLabel(stop)}</Text>
                {stop.label ? <Text style={styles.coordCoords}>{fmtCoords(stop)}</Text> : null}
              </View>
            </View>
          )}
        </ScrollView>

        <Text style={styles.hint}>{tr.draggableHint}</Text>
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
    paddingHorizontal: 8, paddingVertical: 8, gap: 6,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  modeBtnActive: { borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.1)' },
  modeBtnWaypoint: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.15)' },
  pinDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  modeTxt: { color: '#64748B', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  modeTxtActive: { color: '#F97316' },
  modeTxtWaypoint: { color: '#f97316' },

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

  coordBar: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14, paddingVertical: 8,
    maxHeight: 130,
  },
  coordRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4,
  },
  coordDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  coordTexts: { flex: 1 },
  coordLabel: { fontSize: 12, color: '#E2E8F0', fontWeight: '600' },
  coordCoords: { fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 1 },
  coordHint: { fontSize: 12, color: '#475569', textAlign: 'center', paddingVertical: 6 },
  removeWpBtn: {
    padding: 4, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 4,
  },
  removeWpTxt: { color: '#ef4444', fontSize: 11, fontWeight: '700' },

  hint: {
    backgroundColor: '#1E293B', textAlign: 'center',
    color: '#334155', fontSize: 11, paddingBottom: 10, paddingTop: 4,
  },
});
