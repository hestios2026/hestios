import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { PhotoEntry } from '../types';
import { useLang } from '../i18n';

const PHOTOS_DIR = (FileSystem.documentDirectory ?? '') + 'hestios_photos/';

/**
 * Copy photo to app's permanent documentDirectory.
 * - Prevents Android from clearing cache-dir photos before sync.
 * - Converts content:// gallery URIs to file:// (required for uploadAsync).
 * - Falls back to original URI on failure.
 */
async function persistPhoto(uri: string): Promise<string> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
    }
    const dest = `${PHOTOS_DIR}photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (e) {
    console.warn('[PhotoPicker] persistPhoto failed, using original URI:', e);
    return uri;
  }
}

interface Props {
  photos: PhotoEntry[];
  onChange: (photos: PhotoEntry[]) => void;
  minPhotos?: number;
  label?: string; // if omitted, uses tr.photosLabel
}

export default function PhotoPicker({ photos, onChange, minPhotos, label }: Props) {
  const { tr } = useLang();
  const effectiveLabel = label ?? tr.photosLabel;
  const [catPickerIdx, setCatPickerIdx] = useState<number | null>(null);

  const takePicture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(tr.cameraPermission); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      const uri = await persistPhoto(result.assets[0].uri);
      onChange([...photos, { uri, category: tr.photoCategories[0], uploaded: false }]);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(tr.galleryPermission); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsMultipleSelection: true });
    if (!result.canceled && result.assets.length > 0) {
      const newPhotos: PhotoEntry[] = await Promise.all(
        result.assets.map(async (asset) => {
          const uri = await persistPhoto(asset.uri);
          return { uri, category: tr.photoCategories[0], uploaded: false };
        })
      );
      onChange([...photos, ...newPhotos]);
    }
  };

  const removePhoto = (idx: number) => {
    Alert.alert(tr.deletePhoto, '', [
      { text: tr.cancel, style: 'cancel' },
      { text: tr.deleteConfirm, style: 'destructive', onPress: () => onChange(photos.filter((_, i) => i !== idx)) },
    ]);
  };

  const setCategory = (idx: number, cat: string) => {
    const updated = [...photos];
    updated[idx] = { ...updated[idx], category: cat };
    onChange(updated);
    setCatPickerIdx(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{effectiveLabel}</Text>
        {minPhotos !== undefined && (
          <Text style={[styles.minHint, photos.length >= minPhotos && styles.minMet]}>
            {photos.length}/{minPhotos} {tr.photoMin}
          </Text>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {photos.map((photo, idx) => (
          <TouchableOpacity key={idx} style={styles.photoWrap} onLongPress={() => removePhoto(idx)}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.photo}
              resizeMode="cover"
              onError={() => console.warn('[PhotoPicker] Image load error for URI:', photo.uri)}
            />
            <TouchableOpacity style={styles.catBadge} onPress={() => setCatPickerIdx(idx)}>
              <Text style={styles.catText}>{photo.category}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removePhoto(idx)}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addPhoto} onPress={takePicture}>
          <Text style={styles.addPhotoIcon}>📷</Text>
          <Text style={styles.addPhotoLabel}>{tr.camera}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addPhoto} onPress={pickFromGallery}>
          <Text style={styles.addPhotoIcon}>🖼</Text>
          <Text style={styles.addPhotoLabel}>{tr.gallery}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={catPickerIdx !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{tr.photoCategory}</Text>
            <FlatList
              data={tr.photoCategories}
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
              <Text style={styles.modalCloseText}>{tr.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
  minHint: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  minMet: { color: '#22c55e' },
  scroll: { flexDirection: 'row' },
  photoWrap: { marginRight: 8, position: 'relative' },
  photo: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#e2e8f0' },
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
