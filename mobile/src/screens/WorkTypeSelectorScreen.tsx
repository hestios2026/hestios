import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView,
} from 'react-native';
import type { WorkType } from '../types';
import { WORK_TYPE_LABELS } from '../types';

interface Props {
  siteId: number;
  siteName: string;
  nvtNumber: string;
  onSelect: (type: WorkType) => void;
  onBack: () => void;
}

const WORK_TYPES: WorkType[] = [
  'poze_inainte', 'teratest', 'semne_circulatie', 'liefer_scheine',
  'montaj_nvt_pdp', 'hp_plus', 'ha', 'reparatie',
  'tras_teava', 'groapa', 'traversare', 'sapatura', 'raport_zilnic',
];

const TYPE_ICONS: Record<WorkType, string> = {
  poze_inainte:     '📷',
  teratest:         '🔬',
  semne_circulatie: '🚧',
  liefer_scheine:   '📄',
  montaj_nvt_pdp:   '📦',
  hp_plus:          '⚡',
  ha:               '🏠',
  reparatie:        '🔧',
  tras_teava:       '〰️',
  groapa:           '⬛',
  traversare:       '➡️',
  sapatura:         '🔲',
  raport_zilnic:    '📋',
};

export default function WorkTypeSelectorScreen({ siteName, nvtNumber, onSelect, onBack }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Înapoi</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Tip Lucrare</Text>
          <Text style={styles.headerSub}>{siteName}{nvtNumber ? ` — ${nvtNumber}` : ''}</Text>
        </View>
      </View>

      <FlatList
        data={WORK_TYPES}
        keyExtractor={item => item}
        numColumns={2}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              item === 'raport_zilnic' && styles.cardMandatory,
            ]}
            onPress={() => onSelect(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>{TYPE_ICONS[item]}</Text>
            <Text style={[
              styles.cardLabel,
              item === 'raport_zilnic' && styles.cardLabelMandatory,
            ]}>
              {WORK_TYPE_LABELS[item]}
            </Text>
            {item === 'raport_zilnic' && (
              <Text style={styles.mandatoryBadge}>OBLIGATORIU</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  backText: { color: '#F97316', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '700' },
  headerSub: { color: '#64748B', fontSize: 11, marginTop: 1 },
  card: {
    flex: 1, margin: 6,
    backgroundColor: '#fff', borderRadius: 10,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
    minHeight: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    elevation: 1,
  },
  cardMandatory: {
    borderColor: '#F97316', borderWidth: 1.5,
    backgroundColor: 'rgba(249,115,22,0.04)',
  },
  cardIcon: { fontSize: 26, marginBottom: 8 },
  cardLabel: {
    color: '#1E293B', fontSize: 12, fontWeight: '600', textAlign: 'center',
  },
  cardLabelMandatory: { color: '#F97316' },
  mandatoryBadge: {
    marginTop: 4, fontSize: 8, fontWeight: '800',
    color: '#F97316', letterSpacing: 0.5,
  },
});
