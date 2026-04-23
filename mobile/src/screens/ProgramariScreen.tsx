import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  SafeAreaView, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchProgramariZi, updateProgramareStatus, Programare } from '../api/programari';
import { T } from '../theme';

const STATUS_LABEL: Record<string, string> = {
  scheduled:   'Programat',
  in_progress: 'În lucru',
  done:        'Finalizat',
  cancelled:   'Anulat',
};

const STATUS_COLOR: Record<string, string> = {
  scheduled:   T.info,
  in_progress: T.warning,
  done:        T.green,
  cancelled:   '#9CA3AF',
};

function formatTime(iso: string): string {
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso;
  const [h, m] = timePart.split(':');
  return `${(h ?? '00').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const datePart = iso.split('T')[0] ?? iso;
  const [year, month, day] = datePart.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'long' });
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface Props {
  siteId?: number;
  onBack: () => void;
}

export default function ProgramariScreen({ siteId, onBack }: Props) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const TABS = [
    { key: toDateStr(today),    label: 'Azi' },
    { key: toDateStr(tomorrow), label: 'Mâine' },
  ];

  const [tab, setTab] = useState(TABS[0].key);
  const [items, setItems] = useState<Programare[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('hestios_user').then(raw => {
      if (raw) setUserId(JSON.parse(raw).id);
    });
  }, []);

  const load = useCallback(async (day: string, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await fetchProgramariZi(day, siteId);
      setItems(data.filter(p => p.status !== 'cancelled'));
    } catch {
      if (!quiet) Alert.alert('Eroare', 'Nu s-au putut încărca programările.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId !== null) load(tab);
  }, [tab, userId]);

  const handleStatusChange = async (item: Programare, newStatus: string) => {
    try {
      await updateProgramareStatus(item.id, newStatus);
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: newStatus } : p));
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut actualiza statusul.');
    }
  };

  const confirmStatus = (item: Programare, newStatus: string, label: string) => {
    Alert.alert(
      `Marchează ca "${label}"?`,
      `${item.client_name} — ${item.address}`,
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Confirmă', onPress: () => handleStatusChange(item, newStatus) },
      ],
    );
  };

  const pending = items.filter(p => p.status !== 'done').length;
  const done    = items.filter(p => p.status === 'done').length;

  const renderItem = ({ item, index }: { item: Programare; index: number }) => {
    const color    = STATUS_COLOR[item.status] ?? '#9CA3AF';
    const canStart  = item.status === 'scheduled' || item.status === 'new';
    const canFinish = item.status === 'in_progress';
    const isLast    = index === items.length - 1;

    return (
      <View style={S.card}>
        {/* Left: time column */}
        <View style={S.timeCol}>
          <View style={S.timePill}>
            <Text style={S.timeText}>{formatTime(item.scheduled_date)}</Text>
          </View>
          {!isLast && <View style={S.timeLine} />}
        </View>

        {/* Right: info */}
        <View style={S.cardBody}>
          <Text style={S.clientName}>{item.client_name}</Text>
          <Text style={S.addr}>{item.address}{item.city ? `, ${item.city}` : ''}</Text>

          <View style={S.cardMeta}>
            {item.connection_type && (
              <View style={S.typeBadge}>
                <Text style={S.typeText}>{item.connection_type}</Text>
              </View>
            )}
            <View style={[S.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
              <View style={[S.statusDot, { backgroundColor: color }]} />
              <Text style={[S.statusText, { color }]}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
          </View>

          {item.client_phone && (
            <Text style={S.phone}>{item.client_phone}</Text>
          )}
          {item.notes && (
            <Text style={S.notes}>{item.notes}</Text>
          )}

          {(canStart || canFinish) && (
            <View style={S.actions}>
              {canStart && (
                <TouchableOpacity
                  style={[S.actionBtn, { borderColor: T.warning }]}
                  onPress={() => confirmStatus(item, 'in_progress', 'În lucru')}
                  activeOpacity={0.7}
                >
                  <Text style={[S.actionTxt, { color: T.warning }]}>▶ Începe</Text>
                </TouchableOpacity>
              )}
              {canFinish && (
                <TouchableOpacity
                  style={[S.actionBtn, { borderColor: T.green }]}
                  onPress={() => confirmStatus(item, 'done', 'Finalizat')}
                  activeOpacity={0.7}
                >
                  <Text style={[S.actionTxt, { color: T.green }]}>✓ Finalizat</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
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
          <Text style={S.hdrTitle}>Programări</Text>
          <Text style={S.hdrSub}>{formatDate(tab + 'T12:00:00')}</Text>
        </View>
        {!loading && (
          <View style={S.countRow}>
            <View style={S.countBadge}>
              <Text style={S.countTxt}>{pending} în așteptare</Text>
            </View>
            {done > 0 && (
              <View style={[S.countBadge, S.countBadgeDone]}>
                <Text style={[S.countTxt, { color: T.green }]}>{done} ✓</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={S.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[S.tab, tab === t.key && S.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[S.tabTxt, tab === t.key && S.tabTxtActive]}>{t.label}</Text>
            <Text style={[S.tabDate, tab === t.key && S.tabDateActive]}>
              {formatDate(t.key + 'T12:00:00').split(',')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={T.green} size="large" style={{ marginTop: 60 }} />
      ) : items.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyIco}>📅</Text>
          <Text style={S.emptyTxt}>Nicio programare pentru această zi</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(tab, true); }}
              tintColor={T.green}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.dark },

  hdr:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: T.darkCard, borderBottomWidth: 1, borderBottomColor: T.borderDk },
  backBtn:  { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.borderDk, alignItems: 'center', justifyContent: 'center' },
  backTxt:  { color: T.text2, fontSize: 16 },
  hdrTitle: { color: T.textLight, fontSize: 16, fontWeight: '800' },
  hdrSub:   { color: T.text3, fontSize: 11, marginTop: 1 },
  countRow: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  countBadge:     { backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  countBadgeDone: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.2)' },
  countTxt: { fontSize: 9, fontWeight: '700', color: T.warning },

  tabBar:       { flexDirection: 'row', backgroundColor: T.darkCard, borderBottomWidth: 1, borderBottomColor: T.borderDk },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: T.green },
  tabTxt:       { fontSize: 14, fontWeight: '600', color: T.text3 },
  tabTxtActive: { color: T.green },
  tabDate:      { fontSize: 10, color: T.text3, marginTop: 2 },
  tabDateActive:{ color: 'rgba(34,197,94,0.7)' },

  // Card
  card:     { flexDirection: 'row', gap: 12, marginBottom: 0 },
  timeCol:  { alignItems: 'center', width: 52, flexShrink: 0 },
  timePill: { backgroundColor: T.darkCard, borderWidth: 1, borderColor: T.borderDk, borderRadius: 7, paddingHorizontal: 4, paddingVertical: 5, alignItems: 'center' },
  timeText: { fontSize: 12, fontWeight: '800', color: T.textLight, fontVariant: ['tabular-nums'] },
  timeLine: { width: 1, flex: 1, backgroundColor: T.borderDk, marginTop: 4, marginBottom: -4 },

  cardBody:   { flex: 1, backgroundColor: T.darkCard, borderRadius: 12, borderWidth: 1, borderColor: T.borderDk, padding: 12, marginBottom: 10 },
  clientName: { fontSize: 14, fontWeight: '700', color: T.textLight, marginBottom: 3 },
  addr:       { fontSize: 12, color: T.text2, marginBottom: 7 },
  phone:      { fontSize: 11, color: T.text3, marginTop: 4 },
  notes:      { fontSize: 11, color: T.text3, fontStyle: 'italic', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 7, marginTop: 6, borderWidth: 1, borderColor: T.borderDk },

  cardMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  typeBadge:  { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  typeText:   { fontSize: 10, fontWeight: '800', color: T.green },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot:  { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  actions:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  actionTxt: { fontSize: 12, fontWeight: '700' },

  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIco: { fontSize: 44, marginBottom: 12 },
  emptyTxt: { fontSize: 14, color: T.text3 },
});
