/**
 * Reusable photo picker component.
 * - Tap camera icon to take new photo
 * - Tap gallery icon to pick from library
 * - Each photo gets a category dropdown
 * - Photos show timestamp overlay text
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addTimestamp } from '../utils/timestamp';
import type { PhotoEntry } from '../types';
import { PHOTO_CATEGORIES } from '../types';

interface Props {
  photos: PhotoEntry[];
  onChange: (photos: PhotoEntry[]) => void;
  minPhotos?: number;
  requiredCategories?: string[];
  label?: string;
}

export default function PhotoPicker({
  photos, onChange, minPhotos, label = 'Fotografii',
}: Props) {
  const [catPickerIdx, setCatPickerIdx] = useState<number | null>(null);

  const takePicture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permisiune cameră necesară'); return; }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = await addTimestamp(result.assets[0].uri);
      const newPhoto: PhotoEntry = {
        uri,
        category: PHOTO_CATEGORIES[0],
        uploaded: false,
      };
      onChange([...photos, newPhoto]);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permisiune galerie necesară'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newPhotos: PhotoEntry[] = await Promise.all(
        result.assets.map(async (a: { uri: string }) => ({
          uri: await addTimestamp(a.uri),
          category: PHOTO_CATEGORIES[0],
          uploaded: false,
        }))
      );
      onChange([...photos, ...newPhotos]);
    }
  };

  const removePhoto = (idx: number) => {
    Alert.alert('Șterge poza?', '', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => {
        const updated = photos.filter((_, i) => i !== idx);
        onChange(updated);
      }},
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
        <Text style={styles.label}>{label}</Text>
        {minPhotos && (
          <Text style={[styles.minHint, photos.length >= minPhotos && styles.minMet]}>
            {photos.length}/{minPhotos} min
          </Text>
        )}
      </View>

      {/* Photo grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {photos.map((photo, idx) => (
          <TouchableOpacity key={idx} style={styles.photoWrap} onLongPress={() => removePhoto(idx)}>
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.catBadge}
              onPress={() => setCatPickerIdx(idx)}
            >
              <Text style={styles.catText}>{photo.category}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => removePhoto(idx)}>
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Add buttons */}
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
                  style={[
                    styles.catOption,
                    catPickerIdx !== null && photos[catPickerIdx]?.category === item && styles.catOptionActive,
                  ]}
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
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, maxHeight: '60%',
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  catOption: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 8, marginBottom: 4,
  },
  catOptionActive: { backgroundColor: 'rgba(249,115,22,0.1)' },
  catOptionText: { fontSize: 14, color: '#1E293B' },
  modalClose: {
    marginTop: 8, paddingVertical: 12,
    backgroundColor: '#F1F5F9', borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
});
