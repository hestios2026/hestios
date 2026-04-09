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
  completed:   'Finalizat',
  cancelled:   'Anulat',
};

const STATUS_COLOR: Record<string, string> = {
  scheduled:   T.info,
  in_progress: T.warning,
  completed:   T.green,
  cancelled:   '#9CA3AF',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ro-RO', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface Props {
  onBack: () => void;
}

export default function ProgramariScreen({ onBack }: Props) {
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
      const data = await fetchProgramariZi(day);
      // Filter: show only items assigned to current user (as team leader) or unassigned
      setItems(data.filter(p =>
        p.status !== 'cancelled' &&
        (p.assigned_team_id === null || p.assigned_team_id === userId)
      ));
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

  const renderItem = ({ item }: { item: Programare }) => {
    const color = STATUS_COLOR[item.status] ?? '#9CA3AF';
    const canStart = item.status === 'scheduled';
    const canFinish = item.status === 'in_progress';

    return (
      <View style={styles.card}>
        {/* Time + status row */}
        <View style={styles.cardHeader}>
          <Text style={styles.time}>{formatTime(item.scheduled_date)}</Text>
          <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
            <Text style={[styles.statusText, { color }]}>{STATUS_LABEL[item.status] ?? item.status}</Text>
          </View>
        </View>

        {/* Client info */}
        <Text style={styles.clientName}>{item.client_name}</Text>
        <Text style={styles.address}>{item.address}{item.city ? `, ${item.city}` : ''}</Text>

        {item.client_phone && (
          <Text style={styles.phone}>{item.client_phone}</Text>
        )}
        {item.connection_type && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{item.connection_type}</Text>
          </View>
        )}
        {item.notes && (
          <Text style={styles.notes}>{item.notes}</Text>
        )}

        {/* Action buttons */}
        {(canStart || canFinish) && (
          <View style={styles.actions}>
            {canStart && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: T.warning + '20', borderColor: T.warning }]}
                onPress={() => confirmStatus(item, 'in_progress', 'În lucru')}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionText, { color: T.warning }]}>Începe</Text>
              </TouchableOpacity>
            )}
            {canFinish && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: T.green + '20', borderColor: T.green }]}
                onPress={() => confirmStatus(item, 'completed', 'Finalizat')}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionText, { color: T.green }]}>Finalizat</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const pending = items.filter(p => p.status !== 'completed').length;
  const done = items.filter(p => p.status === 'completed').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Înapoi</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Programări</Text>
          {!loading && (
            <Text style={styles.headerSub}>
              {pending} în așteptare · {done} finalizate
            </Text>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            <Text style={[styles.tabDate, tab === t.key && styles.tabDateActive]}>
              {formatDate(t.key + 'T12:00:00')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={T.green} size="large" style={{ marginTop: 60 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyText}>Nicio programare pentru această zi</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.dark, paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: T.borderDk,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: 4 },
  backArrow: { color: T.green, fontSize: 16 },
  backText: { color: T.green, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: T.textLight, fontSize: 15, fontWeight: '700' },
  headerSub: { color: '#6B7280', fontSize: 11, marginTop: 1 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: T.green },
  tabText: { fontSize: 14, fontWeight: '600', color: T.text2 },
  tabTextActive: { color: T.green },
  tabDate: { fontSize: 11, color: T.text3, marginTop: 2 },
  tabDateActive: { color: T.green },

  card: {
    backgroundColor: T.surface,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: T.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  time: { fontSize: 20, fontWeight: '800', color: T.text, letterSpacing: -0.5 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  clientName: { fontSize: 15, fontWeight: '700', color: T.text, marginBottom: 3 },
  address: { fontSize: 13, color: T.text2, marginBottom: 4 },
  phone: { fontSize: 12, color: T.text3, marginBottom: 4 },

  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: T.greenBg, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  typeText: { fontSize: 11, fontWeight: '700', color: T.green },

  notes: {
    fontSize: 12, color: T.text3, fontStyle: 'italic',
    backgroundColor: '#F9FAFB', borderRadius: 6, padding: 8, marginTop: 4,
  },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: T.text3 },
});
