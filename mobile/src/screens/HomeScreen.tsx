import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, SafeAreaView, RefreshControl, TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { fetchSites } from '../api/auth';
import { getQueue, syncQueue } from '../store/offlineQueue';
import type { AuthUser, Site, WorkEntry } from '../types';
import { WORK_TYPE_LABELS } from '../types';

interface Props {
  onAddReport: (siteId: number, siteName: string, nvtNumber: string) => void;
  onLogout: () => void;
  onPontaj: (siteId: number, siteName: string) => void;
}

export default function HomeScreen({ onAddReport, onLogout, onPontaj }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [nvtNumber, setNvtNumber] = useState('');
  const [queue, setQueue] = useState<WorkEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sitePickerOpen, setSitePickerOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const userRaw = await AsyncStorage.getItem('hestios_user');
      if (userRaw) setUser(JSON.parse(userRaw));

      const net = await Network.getNetworkStateAsync();
      setIsOnline(!!net.isConnected);

      const savedSiteRaw = await AsyncStorage.getItem('hestios_selected_site');
      const savedNvt = await AsyncStorage.getItem('hestios_nvt_number') ?? '';
      setNvtNumber(savedNvt);

      // Always try API first, fall back to cache on failure
      try {
        const siteList = await fetchSites();
        setSites(siteList);
        setIsOnline(true);
        await AsyncStorage.setItem('hestios_sites_cache', JSON.stringify(siteList));
        if (savedSiteRaw) {
          const saved = JSON.parse(savedSiteRaw);
          const found = siteList.find((s: Site) => s.id === saved.id);
          setSelectedSite(found ?? saved);
        }
      } catch (e) {
        // API failed — use cache
        const cached = await AsyncStorage.getItem('hestios_sites_cache');
        if (cached) {
          const siteList = JSON.parse(cached);
          setSites(siteList);
          if (savedSiteRaw) setSelectedSite(JSON.parse(savedSiteRaw));
        } else {
          Alert.alert('Eroare conexiune', 'Nu s-a putut conecta la server. Verifică că backend-ul rulează.');
        }
      }

      const q = await getQueue();
      setQueue(q.reverse());
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleSelectSite = async (site: Site) => {
    setSelectedSite(site);
    setSitePickerOpen(false);
    await AsyncStorage.setItem('hestios_selected_site', JSON.stringify(site));
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { synced, failed, lastError } = await syncQueue((cur, total) => {
        console.log(`Sync ${cur}/${total}`);
      });
      const msg = `${synced} intrări trimise${failed > 0 ? `, ${failed} eșuate` : ''}.${lastError ? `\n\nEroare: ${lastError}` : ''}`;
      Alert.alert('Sincronizare completă', msg);
      const q = await getQueue();
      setQueue(q.reverse());
    } catch {
      Alert.alert('Eroare', 'Sincronizarea a eșuat.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddReport = () => {
    if (!selectedSite) {
      Alert.alert('Selectează proiect', 'Alege un proiect înainte de a adăuga un raport.');
      return;
    }
    onAddReport(selectedSite.id, selectedSite.name, nvtNumber);
  };

  const handlePontaj = () => {
    if (!selectedSite) {
      Alert.alert('Selectează proiect', 'Alege un proiect înainte de a face pontajul.');
      return;
    }
    onPontaj(selectedSite.id, selectedSite.name);
  };

  const pendingCount = queue.filter(e => !e.synced).length;

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
        <View>
          <Text style={styles.welcome}>Bun venit, {user?.full_name?.split(' ')[0]}</Text>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
            <Text style={styles.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Ieșire</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={queue}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
        ListHeaderComponent={(
          <View>
            {/* Project selector */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PROIECT / ȘANTIER</Text>
              <TouchableOpacity
                style={styles.projectSelector}
                onPress={() => setSitePickerOpen(!sitePickerOpen)}
                activeOpacity={0.8}
              >
                <Text style={selectedSite ? styles.projectText : styles.projectPlaceholder}>
                  {selectedSite ? `${selectedSite.kst} — ${selectedSite.name}` : 'Selectează șantier...'}
                </Text>
                <Text style={styles.chevron}>{sitePickerOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {sitePickerOpen && (
                <View style={styles.siteList}>
                  {sites.map(site => (
                    <TouchableOpacity
                      key={site.id}
                      style={[styles.siteItem, selectedSite?.id === site.id && styles.siteItemActive]}
                      onPress={() => handleSelectSite(site)}
                    >
                      <Text style={[styles.siteKst, selectedSite?.id === site.id && styles.siteTextActive]}>
                        {site.kst}
                      </Text>
                      <Text style={[styles.siteName, selectedSite?.id === site.id && styles.siteTextActive]}>
                        {site.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* NVT number */}
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>NR. NVT / PDP</Text>
              <TextInput
                style={styles.nvtInput}
                value={nvtNumber}
                onChangeText={v => {
                  setNvtNumber(v);
                  AsyncStorage.setItem('hestios_nvt_number', v);
                }}
                placeholder="ex: NVT-1234 / PDP-05..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                returnKeyType="done"
              />
            </View>

            {/* Sync banner */}
            {pendingCount > 0 && (
              <TouchableOpacity
                style={styles.syncBanner}
                onPress={isOnline ? handleSync : undefined}
                activeOpacity={isOnline ? 0.8 : 1}
              >
                {syncing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.syncText}>
                    {isOnline
                      ? `${pendingCount} raport${pendingCount > 1 ? 'e' : ''} nesincronizat${pendingCount > 1 ? 'e' : ''} — Apasă pentru sync`
                      : `${pendingCount} raport${pendingCount > 1 ? 'e' : ''} în așteptare (offline)`
                    }
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Add report */}
            <TouchableOpacity style={styles.addBtn} onPress={handleAddReport} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>+ Adaugă Raport</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pontajBtn} onPress={handlePontaj} activeOpacity={0.85}>
              <Text style={styles.pontajBtnText}>Pontaj Echipă</Text>
            </TouchableOpacity>

            {queue.length > 0 && (
              <Text style={styles.historyLabel}>RAPOARTE LOCALE</Text>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.entryCard, item.synced && styles.entryCardSynced]}>
            <View style={styles.entryCardRow}>
              <Text style={styles.entryType}>{WORK_TYPE_LABELS[item.work_type]}</Text>
              <View style={[styles.badge, item.synced ? styles.badgeSynced : styles.badgePending]}>
                <Text style={styles.badgeText}>{item.synced ? '✓ Sync' : 'Pending'}</Text>
              </View>
            </View>
            <Text style={styles.entrySite}>{item.site_name} — {item.nvt_number || '—'}</Text>
            <Text style={styles.entryDate}>{new Date(item.created_at).toLocaleString('ro-RO')}</Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Niciun raport local.</Text>
            <Text style={styles.emptySubText}>Apasă „+ Adaugă Raport" pentru a începe.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
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
  orangeLight: 'rgba(249,115,22,0.1)',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.sidebar,
  },
  welcome: { color: '#F1F5F9', fontSize: 15, fontWeight: '600' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { color: '#64748B', fontSize: 11 },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#64748B', fontSize: 12 },
  section: { margin: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 6 },
  projectSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
  },
  projectText: { color: C.text, fontSize: 14, flex: 1 },
  projectPlaceholder: { color: C.muted, fontSize: 14, flex: 1 },
  chevron: { color: C.muted, fontSize: 12 },
  siteList: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  siteItem: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  siteItemActive: { backgroundColor: C.orangeLight },
  siteKst: { color: C.muted, fontSize: 12, width: 44 },
  siteName: { color: C.text, fontSize: 13, flex: 1 },
  siteTextActive: { color: C.orange, fontWeight: '600' },
  nvtInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: C.text,
  },
  syncBanner: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#F97316', borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  syncText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  addBtn: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: C.orange, borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pontajBtn: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#0F172A', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  pontajBtnText: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  historyLabel: {
    fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1,
    marginHorizontal: 16, marginBottom: 8,
  },
  entryCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.surface, borderRadius: 8,
    padding: 12, borderWidth: 1, borderColor: C.border,
  },
  entryCardSynced: { opacity: 0.7 },
  entryCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  entryType: { color: C.text, fontSize: 13, fontWeight: '600', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePending: { backgroundColor: 'rgba(249,115,22,0.12)' },
  badgeSynced: { backgroundColor: 'rgba(34,197,94,0.12)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.muted },
  entrySite: { color: C.muted, fontSize: 12 },
  entryDate: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  emptySubText: { color: '#94A3B8', fontSize: 13, marginTop: 6 },
});
