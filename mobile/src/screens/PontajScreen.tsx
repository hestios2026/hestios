import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { fetchMyTeam, TeamWorker } from '../api/pontaj';
import { enqueuePontaj, syncPontajQueue, getPontajQueue } from '../store/pontajQueue';
import { newUUID } from '../utils/timestamp';

interface Props {
  siteId: number;
  siteName: string;
  onBack: () => void;
}

interface WorkerRow extends TeamWorker {
  present: boolean;
  ora_start: string;
  ora_stop: string;
  notes: string;
}

function dateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDateRO(s: string) {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

export default function PontajScreen({ siteId, siteName, onBack }: Props) {
  const [date, setDate] = useState(dateStr(new Date()));
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const loadTeam = useCallback(async () => {
    try {
      const team = await fetchMyTeam();
      setWorkers(team.map(w => ({
        ...w,
        present: true,
        ora_start: '07:00',
        ora_stop: '17:00',
        notes: '',
      })));
      const net = await Network.getNetworkStateAsync();
      setIsOnline(!!net.isConnected);
    } catch {
      // keep existing workers
    }
    const q = await getPontajQueue();
    setPendingCount(q.filter(p => !p.synced).length);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTeam();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTeam();
    setRefreshing(false);
  }, [loadTeam]);

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(dateStr(d));
  };

  const togglePresent = (idx: number) => {
    setWorkers(prev => prev.map((w, i) => i === idx ? { ...w, present: !w.present } : w));
  };

  const updateTime = (idx: number, field: 'ora_start' | 'ora_stop', val: string) => {
    setWorkers(prev => prev.map((w, i) => i === idx ? { ...w, [field]: val } : w));
  };

  const updateNotes = (idx: number, val: string) => {
    setWorkers(prev => prev.map((w, i) => i === idx ? { ...w, notes: val } : w));
  };

  const handleSave = async () => {
    if (workers.length === 0) {
      Alert.alert('Echipă goală', 'Nu ai muncitori asignați. Contactează directorul pentru a-ți asigna echipa.');
      return;
    }

    setSaving(true);
    try {
      const userRaw = await AsyncStorage.getItem('hestios_user');
      const user = userRaw ? JSON.parse(userRaw) : { id: 0 };

      const payload = {
        local_uuid: newUUID(),
        date,
        site_id: siteId,
        workers: workers.map(w => ({
          employee_id: w.employee_id,
          present: w.present,
          ora_start: w.present ? w.ora_start : undefined,
          ora_stop: w.present ? w.ora_stop : undefined,
          notes: w.notes || undefined,
        })),
      };

      await enqueuePontaj(payload);

      // Try to sync immediately if online
      if (isOnline) {
        const { synced, failed, lastError } = await syncPontajQueue();
        if (failed > 0) {
          Alert.alert('Salvat local', `Pontajul a fost salvat. Sincronizare eșuată: ${lastError ?? 'eroare necunoscută'}`);
        } else {
          Alert.alert('Trimis', 'Pontajul a fost trimis cu succes.', [{ text: 'OK', onPress: onBack }]);
          return;
        }
      } else {
        Alert.alert('Salvat offline', 'Pontajul a fost salvat și va fi trimis când ai internet.', [{ text: 'OK', onPress: onBack }]);
        return;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSaving(true);
    try {
      const { synced, failed, lastError } = await syncPontajQueue();
      const msg = `${synced} pontaj${synced !== 1 ? 'e' : ''} trimise${failed > 0 ? `, ${failed} eșuate${lastError ? ': ' + lastError : ''}` : ''}.`;
      Alert.alert('Sincronizare', msg);
      const q = await getPontajQueue();
      setPendingCount(q.filter(p => !p.synced).length);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F97316" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Înapoi</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Pontaj Echipă</Text>
          <Text style={styles.headerSite}>{siteName}</Text>
        </View>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Date selector */}
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(-1)}>
            <Text style={styles.dateBtnTxt}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDateRO(date)}</Text>
          <TouchableOpacity
            style={[styles.dateBtn, date >= dateStr(new Date()) && styles.dateBtnDisabled]}
            onPress={() => date < dateStr(new Date()) && changeDate(1)}
          >
            <Text style={styles.dateBtnTxt}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Pending sync banner */}
        {pendingCount > 0 && isOnline && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSync} activeOpacity={0.8}>
            <Text style={styles.syncText}>{pendingCount} pontaj nesincronizat — Apasă pentru sync</Text>
          </TouchableOpacity>
        )}

        {/* Column headers */}
        {workers.length > 0 && (
          <View style={styles.tableHeader}>
            <Text style={[styles.colLabel, { flex: 1 }]}>MUNCITOR</Text>
            <Text style={[styles.colLabel, { width: 60, textAlign: 'center' }]}>PREZENT</Text>
            <Text style={[styles.colLabel, { width: 52, textAlign: 'center' }]}>START</Text>
            <Text style={[styles.colLabel, { width: 52, textAlign: 'center' }]}>STOP</Text>
          </View>
        )}

        {/* Worker rows */}
        {workers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nicio echipă asignată</Text>
            <Text style={styles.emptyText}>Directorul trebuie să îți asigneze muncitorii din HestiOS.</Text>
          </View>
        ) : (
          workers.map((w, idx) => (
            <View key={w.employee_id} style={styles.workerCard}>
              <View style={styles.workerRow}>
                <Text style={styles.workerName} numberOfLines={1}>{w.employee_name}</Text>
                <TouchableOpacity
                  style={[styles.presentToggle, w.present && styles.presentToggleOn]}
                  onPress={() => togglePresent(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presentToggleText, w.present && styles.presentToggleTextOn]}>
                    {w.present ? 'DA' : 'NU'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.timeInput, !w.present && styles.timeInputDisabled]}
                  value={w.ora_start}
                  onChangeText={v => updateTime(idx, 'ora_start', v)}
                  editable={w.present}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.timeInput, !w.present && styles.timeInputDisabled]}
                  value={w.ora_stop}
                  onChangeText={v => updateTime(idx, 'ora_stop', v)}
                  editable={w.present}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              {!w.present && (
                <TextInput
                  style={styles.notesInput}
                  value={w.notes}
                  onChangeText={v => updateNotes(idx, v)}
                  placeholder="Motiv absență (ex: concediu medical, zi liberă...)"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="done"
                />
              )}
            </View>
          ))
        )}

        {/* Save button */}
        {workers.length > 0 && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Trimite Pontaj</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const C = {
  bg: '#F8FAFC',
  sidebar: '#0F172A',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#1E293B',
  muted: '#64748B',
  orange: '#F97316',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.sidebar,
  },
  backBtn: { padding: 4 },
  backText: { color: '#94A3B8', fontSize: 16 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '700' },
  headerSite: { color: '#64748B', fontSize: 11, marginTop: 1 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 20,
  },
  dateBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dateBtnDisabled: { opacity: 0.3 },
  dateBtnTxt: { fontSize: 22, color: C.text, lineHeight: 26 },
  dateText: { fontSize: 17, fontWeight: '700', color: C.text, minWidth: 110, textAlign: 'center' },
  syncBanner: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: C.orange,
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
  },
  syncText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  colLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.8 },
  workerCard: {
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  workerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  notesInput: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: C.text,
  },
  workerName: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
  presentToggle: {
    width: 44, height: 28, borderRadius: 14, marginHorizontal: 8,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  presentToggleOn: { backgroundColor: 'rgba(34,197,94,0.15)' },
  presentToggleText: { fontSize: 11, fontWeight: '700', color: '#ef4444' },
  presentToggleTextOn: { color: '#16a34a' },
  timeInput: {
    width: 48, height: 32, borderWidth: 1, borderColor: C.border,
    borderRadius: 6, textAlign: 'center', fontSize: 12,
    color: C.text, backgroundColor: C.surface, marginHorizontal: 2,
  },
  timeInputDisabled: { backgroundColor: '#F1F5F9', color: C.muted },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
  saveBtn: {
    marginHorizontal: 16, marginTop: 20, backgroundColor: C.orange,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
