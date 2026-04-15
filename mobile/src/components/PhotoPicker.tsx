/**
 * PhotoPicker — camera / gallery with timestamp burned into each photo via Canvas.
 */
import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import type { PhotoEntry } from '../types';
import { PHOTO_CATEGORIES } from '../types';

// ─── Timestamp canvas HTML ────────────────────────────────────────────────────

const CANVAS_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0}body{background:#000}</style>
</head><body>
<canvas id="c"></canvas>
<script>
document.addEventListener('message', handle);
window.addEventListener('message', handle);
function handle(e) {
  try {
    var d = JSON.parse(e.data);
    if (d.type === 'process') burnTimestamp(d.base64, d.label);
  } catch(err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: String(err) }));
  }
}
function burnTimestamp(base64, label) {
  var img = new Image();
  img.onload = function() {
    var c = document.getElementById('c');
    c.width  = img.width;
    c.height = img.height;
    var ctx = c.getContext('2d');

    // Draw photo
    ctx.drawImage(img, 0, 0);

    // Bottom bar
    var barH  = Math.max(52, Math.round(img.height * 0.055));
    var fSize = Math.round(barH * 0.46);
    var pad   = Math.round(barH * 0.22);

    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, img.height - barH, img.width, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + fSize + 'px monospace';
    ctx.textAlign  = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pad, img.height - barH / 2);

    var result = c.toDataURL('image/jpeg', 0.84);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'done', data: result }));
  };
  img.onerror = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: 'Image load failed' }));
  };
  img.src = 'data:image/jpeg;base64,' + base64;
}
</script></body></html>`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowLabel(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function uriToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function base64ToUri(dataUrl: string): Promise<string> {
  // dataUrl = "data:image/jpeg;base64,/9j/..."
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const path = FileSystem.cacheDirectory + `ts_${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  photos: PhotoEntry[];
  onChange: (photos: PhotoEntry[]) => void;
  minPhotos?: number;
  label?: string;
}

interface PendingItem { uri: string; category: string; }

export default function PhotoPicker({ photos, onChange, minPhotos, label = 'Fotografii' }: Props) {
  const [catPickerIdx, setCatPickerIdx] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const webRef = useRef<WebView>(null);
  const processingRef = useRef(false);

  // ── WebView message handler ─────────────────────────────────────────────────
  const handleWebMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'done') {
        const newUri = await base64ToUri(msg.data);
        setPending(prev => {
          const [current, ...rest] = prev;
          const newPhoto: PhotoEntry = { uri: newUri, category: current.category, uploaded: false };
          onChange([...photos, newPhoto]);
          processingRef.current = false;
          // Trigger next if any
          setTimeout(() => processNext(rest), 50);
          return rest;
        });
      } else if (msg.type === 'error') {
        console.warn('[PhotoPicker] canvas error:', msg.msg);
        // Fallback: add original photo without timestamp
        setPending(prev => {
          const [current, ...rest] = prev;
          onChange([...photos, { uri: current.uri, category: current.category, uploaded: false }]);
          processingRef.current = false;
          setTimeout(() => processNext(rest), 50);
          return rest;
        });
      }
    } catch {}
  };

  const processNext = async (queue: PendingItem[]) => {
    if (queue.length === 0 || processingRef.current) return;
    processingRef.current = true;
    const item = queue[0];
    try {
      const base64 = await uriToBase64(item.uri);
      webRef.current?.postMessage(JSON.stringify({
        type: 'process',
        base64,
        label: nowLabel(),
      }));
    } catch {
      processingRef.current = false;
    }
  };

  const enqueue = async (uris: string[], category = PHOTO_CATEGORIES[0]) => {
    const items: PendingItem[] = uris.map(uri => ({ uri, category }));
    setPending(prev => {
      const next = [...prev, ...items];
      if (!processingRef.current) setTimeout(() => processNext(next), 50);
      return next;
    });
  };

  // ── Camera / gallery ────────────────────────────────────────────────────────
  const takePicture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permisiune cameră necesară'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      enqueue([result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permisiune galerie necesară'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
    if (!result.canceled) {
      enqueue(result.assets.map((a: { uri: string }) => a.uri));
    }
  };

  const removePhoto = (idx: number) => {
    Alert.alert('Șterge poza?', '', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => onChange(photos.filter((_, i) => i !== idx)) },
    ]);
  };

  const setCategory = (idx: number, cat: string) => {
    const updated = [...photos];
    updated[idx] = { ...updated[idx], category: cat };
    onChange(updated);
    setCatPickerIdx(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Hidden WebView for canvas processing */}
      <View style={styles.hiddenWebView}>
        <WebView
          ref={webRef}
          source={{ html: CANVAS_HTML }}
          onMessage={handleWebMessage}
          javaScriptEnabled
          originWhitelist={['*']}
          onLoad={() => {
            // If items were enqueued before WebView was ready, start processing
            setPending(prev => {
              if (prev.length > 0 && !processingRef.current) processNext(prev);
              return prev;
            });
          }}
        />
      </View>

      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {pending.length > 0 && (
            <Text style={styles.processingHint}>⏳ {pending.length} se procesează...</Text>
          )}
          {minPhotos && (
            <Text style={[styles.minHint, photos.length >= minPhotos && styles.minMet]}>
              {photos.length}/{minPhotos} min
            </Text>
          )}
        </View>
      </View>

      {/* Photo grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {photos.map((photo, idx) => (
          <TouchableOpacity key={idx} style={styles.photoWrap} onLongPress={() => removePhoto(idx)}>
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <TouchableOpacity style={styles.catBadge} onPress={() => setCatPickerIdx(idx)}>
              <Text style={styles.catText}>{photo.category}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removePhoto(idx)}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Pending placeholders */}
        {pending.map((_, i) => (
          <View key={`pending-${i}`} style={[styles.photoWrap, styles.pendingWrap]}>
            <View style={styles.photo}>
              <Text style={styles.pendingIcon}>⏳</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addPhoto} onPress={takePicture}>
          <Text style={styles.addPhotoIcon}>📷</Text>
          <Text style={styles.addPhotoLabel}>Cameră</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addPhoto} onPress={pickFromGallery}>
          <Text style={styles.addPhotoIcon}>🖼</Text>
          <Text style={styles.addPhotoLabel}>Galerie</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Category picker modal */}
      <Modal visible={catPickerIdx !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Categorie Poză</Text>
            <FlatList
              data={PHOTO_CATEGORIES}
              keyExtractor={c => c}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.catOption, catPickerIdx !== null && photos[catPickerIdx]?.category === item && styles.catOptionActive]}
                  onPress={() => catPickerIdx !== null && setCategory(catPickerIdx, item)}
                >
                  <Text style={styles.catOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCatPickerIdx(null)}>
              <Text style={styles.modalCloseText}>Anulează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  hiddenWebView: { width: 1, height: 1, position: 'absolute', opacity: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
  minHint: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  minMet: { color: '#22c55e' },
  processingHint: { fontSize: 10, color: '#f97316', fontWeight: '600' },
  scroll: { flexDirection: 'row' },
  photoWrap: { marginRight: 8, position: 'relative' },
  photo: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  pendingWrap: { opacity: 0.5 },
  pendingIcon: { fontSize: 28 },
  catBadge: {
    position: 'absolute', bottom: 4, left: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 2,
  },
  catText: { color: '#fff', fontSize: 9, fontWeight: '600', textAlign: 'center' },
  deleteBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhoto: {
    width: 100, height: 100, borderRadius: 8,
    backgroundColor: '#F8FAFC', borderWidth: 1.5,
    borderColor: '#E2E8F0', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  addPhotoIcon: { fontSize: 24 },
  addPhotoLabel: { color: '#64748B', fontSize: 11, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  catOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 4 },
  catOptionActive: { backgroundColor: 'rgba(249,115,22,0.1)' },
  catOptionText: { fontSize: 14, color: '#1E293B' },
  modalClose: { marginTop: 8, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 8, alignItems: 'center' },
  modalCloseText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
});
