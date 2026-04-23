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

const TYPE_ICON: Record<WorkType, string> = {
  poze_inainte:     '📷',
  teratest:         '✅',
  semne_circulatie: '🚧',
  liefer_scheine:   '📦',
  montaj_nvt_pdp:   '🔧',
  hp_plus:          '⚡',
  ha:               '🔌',
  reparatie:        '🔨',
  tras_teava:       '〰',
  groapa:           '⛏',
  traversare:       '↔',
  sapatura:         '🚜',
  raport_zilnic:    '📄',
};

const TYPE_ACCENT: Record<WorkType, string> = {
  poze_inainte:     T.info,
  teratest:         T.green,
  semne_circulatie: T.warning,
  liefer_scheine:   '#6B7280',
  montaj_nvt_pdp:   '#0891B2',
  hp_plus:          '#8B5CF6',
  ha:               T.green,
  reparatie:        T.danger,
  tras_teava:       '#6B7280',
  groapa:           '#B45309',
  traversare:       '#0891B2',
  sapatura:         '#B45309',
  raport_zilnic:    T.green,
};

export default function WorkTypeSelectorScreen({ siteName, nvtNumber, onSelect, onBack }: Props) {
  const { tr } = useLang();

  const renderItem = ({ item }: { item: WorkType }) => {
    const isMandatory = item === 'raport_zilnic';
    const accent = TYPE_ACCENT[item];

    return (
      <TouchableOpacity
        style={[S.card, isMandatory && S.cardMandatory]}
        onPress={() => onSelect(item)}
        activeOpacity={0.7}
      >
        <View style={[S.iconWrap, { backgroundColor: `${accent}18` }]}>
          <Text style={S.icon}>{TYPE_ICON[item]}</Text>
        </View>
        <Text style={[S.cardLabel, isMandatory && { color: T.green }]} numberOfLines={2}>
          {tr.workTypeLabels[item]}
        </Text>
        {isMandatory && (
          <View style={S.mandatoryDot} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={S.root}>
      {/* Header */}
      <View style={S.hdr}>
        <TouchableOpacity style={S.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={S.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.hdrTitle}>{tr.workTypeTitle}</Text>
          <Text style={S.hdrSub} numberOfLines={1}>
            {siteName}{nvtNumber ? ` · ${nvtNumber}` : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={WORK_TYPES}
        keyExtractor={item => item}
        numColumns={3}
        contentContainerStyle={S.grid}
        columnWrapperStyle={S.row}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const CARD_SIZE = '31%';

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.dark },

  hdr:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: T.darkCard, borderBottomWidth: 1, borderBottomColor: T.borderDk },
  backBtn:  { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.borderDk, alignItems: 'center', justifyContent: 'center' },
  backTxt:  { color: T.text2, fontSize: 16 },
  hdrTitle: { color: T.textLight, fontSize: 15, fontWeight: '800' },
  hdrSub:   { color: T.text3, fontSize: 11, marginTop: 1 },

  grid: { padding: 12, paddingBottom: 32, gap: 10 },
  row:  { gap: 10, justifyContent: 'flex-start' },

  card: {
    width: CARD_SIZE,
    aspectRatio: 0.9,
    backgroundColor: T.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.borderDk,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 7,
    position: 'relative',
  },
  cardMandatory: {
    borderColor: 'rgba(34,197,94,0.35)',
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon:       { fontSize: 20 },
  cardLabel:  { color: T.text2, fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
  mandatoryDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: T.green,
  },
});
