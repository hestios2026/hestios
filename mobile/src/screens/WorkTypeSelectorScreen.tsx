import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView,
} from 'react-native';
import type { WorkType } from '../types';
import { T } from '../theme';
import { useLang } from '../i18n';

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

const TYPE_CONFIG: Record<WorkType, { abbr: string; color: string }> = {
  poze_inainte:     { abbr: 'PI', color: '#3B82F6' },
  teratest:         { abbr: 'TT', color: '#8B5CF6' },
  semne_circulatie: { abbr: 'SC', color: '#F59E0B' },
  liefer_scheine:   { abbr: 'LS', color: '#6B7280' },
  montaj_nvt_pdp:   { abbr: 'NV', color: '#0891B2' },
  hp_plus:          { abbr: 'HP', color: '#8B5CF6' },
  ha:               { abbr: 'HA', color: T.green },
  reparatie:        { abbr: 'RE', color: '#EF4444' },
  tras_teava:       { abbr: 'TȚ', color: '#6B7280' },
  groapa:           { abbr: 'GR', color: '#B45309' },
  traversare:       { abbr: 'TR', color: '#0891B2' },
  sapatura:         { abbr: 'SA', color: '#B45309' },
  raport_zilnic:    { abbr: 'RZ', color: T.green },
};

export default function WorkTypeSelectorScreen({ siteName, nvtNumber, onSelect, onBack }: Props) {
  const { tr } = useLang();
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>{tr.back.replace('‹ ', '')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{tr.workTypeTitle}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {siteName}{nvtNumber ? ` — ${nvtNumber}` : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={WORK_TYPES}
        keyExtractor={item => item}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const cfg = TYPE_CONFIG[item];
          const isMandatory = item === 'raport_zilnic';
          return (
            <TouchableOpacity
              style={[styles.card, isMandatory && styles.cardMandatory]}
              onPress={() => onSelect(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.typeBadge, { backgroundColor: `${cfg.color}18` }]}>
                <Text style={[styles.typeAbbr, { color: cfg.color }]}>{cfg.abbr}</Text>
              </View>

              <Text style={[styles.cardLabel, isMandatory && styles.cardLabelMandatory]} numberOfLines={2}>
                {tr.workTypeLabels[item]}
              </Text>

              {isMandatory && (
                <View style={styles.mandatoryPill}>
                  <Text style={styles.mandatoryText}>{tr.mandatory}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.dark, paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: T.borderDk,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingRight: 4,
  },
  backArrow: { color: T.green, fontSize: 16, fontWeight: '400' },
  backText: { color: T.green, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: T.textLight, fontSize: 15, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.surface,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: T.border,
    gap: 12,
  },
  cardMandatory: {
    borderColor: T.green,
    borderWidth: 1.5,
    backgroundColor: T.greenBg,
  },
  typeBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  typeAbbr: {
    fontSize: 14, fontWeight: '900', letterSpacing: 0.5,
  },
  cardLabel: {
    color: T.text, fontSize: 14, fontWeight: '600',
    flex: 1, lineHeight: 20,
  },
  cardLabelMandatory: { color: T.green },
  mandatoryPill: {
    backgroundColor: T.greenDim,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    flexShrink: 0,
  },
  mandatoryText: {
    fontSize: 8, fontWeight: '800', color: T.green, letterSpacing: 0.6,
  },
});
