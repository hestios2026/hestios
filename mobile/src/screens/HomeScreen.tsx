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
import { T } from '../theme';

interface Props {
  onAddReport: (siteId: number, siteName: string, nvtNumber: string) => void;
  onLogout: () => void;
  onPontaj: (siteId: number, siteName: string) => void;
  onProgramari: () => void;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const ini = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{ini}</Text>
    </View>
  );
}

export default function HomeScreen({ onAddReport, onLogout, onPontaj, onProgramari }: Props) {
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

  useEffect(() => { loadData(); }, []);

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
      } catch {
        const cached = await AsyncStorage.getItem('hestios_sites_cache');
        if (cached) {
          const siteList = JSON.parse(cached);
          setSites(siteList);
          if (savedSiteRaw) setSelectedSite(JSON.parse(savedSiteRaw));
        } else {
          Alert.alert('Eroare conexiune', 'Nu s-a putut conecta la server.');
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
    } catch (err: any) {
      Alert.alert('Eroare sync', err?.message ?? String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleClearQueue = () => {
    Alert.alert(
      'Golire coadă',
      'Șterge toate rapoartele locale nesincronizate? Această acțiune nu poate fi anulată.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge tot',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('hestios_offline_queue');
            setQueue([]);
          },
        },
      ]
    );
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
        <ActivityIndicator color={T.green} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {user && <Initials name={user.full_name} />}
          <View>
            <Text style={styles.welcome}>
              {user?.full_name?.split(' ')[0] ?? 'Bun venit'}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? T.green : T.danger }]} />
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Ieșire</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={queue}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.green} />
        }
        ListHeaderComponent={(
          <View>
            {/* Project selector card */}
            <View style={styles.selectorCard}>
              <Text style={styles.fieldLabel}>PROIECT / ȘANTIER</Text>
              <TouchableOpacity
                style={[styles.selector, sitePickerOpen && styles.selectorOpen]}
                onPress={() => setSitePickerOpen(!sitePickerOpen)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  {selectedSite ? (
                    <>
                      <Text style={styles.siteKstBadge}>{selectedSite.kst}</Text>
                      <Text style={styles.siteName}>{selectedSite.name}</Text>
                    </>
                  ) : (
                    <Text style={styles.selectorPlaceholder}>Selectează șantier...</Text>
                  )}
                </View>
                <Text style={styles.chevron}>{sitePickerOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {sitePickerOpen && (
                <View style={styles.dropList}>
                  {sites.map(site => {
                    const active = selectedSite?.id === site.id;
                    return (
                      <TouchableOpacity
                        key={site.id}
                        style={[styles.dropItem, active && styles.dropItemActive]}
                        onPress={() => handleSelectSite(site)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropKst, active && styles.dropTextActive]}>
                          {site.kst}
                        </Text>
                        <Text style={[styles.dropName, active && styles.dropTextActive]}>
                          {site.name}
                        </Text>
                        {active && (
                          <View style={styles.checkDot} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* NVT */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>NR. NVT / PDP</Text>
              <TextInput
                style={styles.nvtInput}
                value={nvtNumber}
                onChangeText={v => {
                  setNvtNumber(v);
                  AsyncStorage.setItem('hestios_nvt_number', v);
                }}
                placeholder="ex: NVT-1234 / PDP-05..."
                placeholderTextColor={T.text3}
                autoCapitalize="characters"
                returnKeyType="done"
              />
            </View>

            {/* Sync banner */}
            {pendingCount > 0 && (
              <View style={styles.syncRow}>
                <TouchableOpacity
                  style={[styles.syncBanner, !isOnline && styles.syncBannerOffline, { flex: 1 }]}
                  onPress={isOnline ? handleSync : undefined}
                  activeOpacity={isOnline ? 0.8 : 1}
                >
                  {syncing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <View style={styles.syncDot} />
                      <Text style={styles.syncText}>
                        {isOnline
                          ? `${pendingCount} raport${pendingCount > 1 ? 'e' : ''} nesincronizat${pendingCount > 1 ? 'e' : ''} — Apasă`
                          : `${pendingCount} raport${pendingCount > 1 ? 'e' : ''} în așteptare (offline)`
                        }
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearBtn} onPress={handleClearQueue} activeOpacity={0.8}>
                  <Text style={styles.clearBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CTA Buttons */}
            <View style={styles.ctaWrap}>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAddReport} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>+ Adaugă Raport</Text>
              </TouchableOpacity>

              <View style={styles.ctaRow}>
                <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }]} onPress={handlePontaj} activeOpacity={0.85}>
                  <Text style={styles.btnSecondaryText}>Pontaj Echipă</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnProgramari, { flex: 1 }]} onPress={onProgramari} activeOpacity={0.85}>
                  <Text style={styles.btnProgramariText}>📅 Programări</Text>
                </TouchableOpacity>
              </View>
            </View>

            {queue.length > 0 && (
              <Text style={styles.sectionTitle}>RAPOARTE LOCALE</Text>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.entryCard, item.synced && styles.entryCardSynced]}>
            <View style={styles.entryRow}>
              <Text style={styles.entryType}>{WORK_TYPE_LABELS[item.work_type]}</Text>
              <View style={[styles.badge, item.synced ? styles.badgeSynced : styles.badgePending]}>
                <Text style={[styles.badgeText, item.synced ? styles.badgeTextSynced : styles.badgeTextPending]}>
                  {item.synced ? '✓ Sync' : 'Pending'}
                </Text>
              </View>
            </View>
            <Text style={styles.entrySite}>{item.site_name}{item.nvt_number ? ` — ${item.nvt_number}` : ''}</Text>
            <Text style={styles.entryDate}>{new Date(item.created_at).toLocaleString('ro-RO')}</Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>☰</Text>
            </View>
            <Text style={styles.emptyText}>Niciun raport local</Text>
            <Text style={styles.emptySubText}>Apasă „+ Adaugă Raport" pentru a începe.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: T.dark,
    borderBottomWidth: 1, borderBottomColor: T.borderDk,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.greenDim,
    borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: T.green, fontSize: 12, fontWeight: '800' },
  welcome: { color: T.textLight, fontSize: 14, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#374151', fontSize: 10 },
  logoutBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, borderColor: '#1F2937',
  },
  logoutText: { color: '#374151', fontSize: 12, fontWeight: '500' },

  // Selector card
  selectorCard: {
    margin: 14,
    backgroundColor: T.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1, borderColor: T.border,
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: T.text3,
    letterSpacing: 0.8, marginBottom: 8,
  },
  selector: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: T.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: T.bg,
  },
  selectorOpen: {
    borderColor: T.green,
  },
  siteKstBadge: {
    fontSize: 10, fontWeight: '700', color: T.green,
    letterSpacing: 0.5, marginBottom: 1,
  },
  siteName: { color: T.text, fontSize: 14, fontWeight: '500' },
  selectorPlaceholder: { color: T.text3, fontSize: 14 },
  chevron: { color: T.text3, fontSize: 11, marginLeft: 8 },

  dropList: {
    marginTop: 4, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, overflow: 'hidden', backgroundColor: T.surface,
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  dropItemActive: { backgroundColor: T.greenBg },
  dropKst: { color: T.text3, fontSize: 11, width: 42, fontWeight: '600' },
  dropName: { color: T.text, fontSize: 13, flex: 1 },
  dropTextActive: { color: T.green, fontWeight: '600' },
  checkDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: T.green,
  },

  nvtInput: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: T.text,
  },

  // Sync banner
  syncRow: { flexDirection: 'row', marginHorizontal: 14, marginBottom: 12, gap: 8 },
  syncBanner: {
    backgroundColor: T.green, borderRadius: 8,
    paddingVertical: 11, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  syncBannerOffline: { backgroundColor: T.warning },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  syncText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  clearBtn: {
    backgroundColor: '#1F2937', borderRadius: 8,
    width: 44, alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { fontSize: 18 },

  // CTA
  ctaWrap: { paddingHorizontal: 14, marginBottom: 8, gap: 10 },
  ctaRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    backgroundColor: T.green, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: T.green, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: T.dark, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#1F2937',
  },
  btnSecondaryText: { color: T.text3, fontSize: 15, fontWeight: '600' },
  btnProgramari: {
    backgroundColor: T.greenDim, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: T.green,
  },
  btnProgramariText: { color: T.green, fontSize: 14, fontWeight: '700' },

  // History
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: T.text3,
    letterSpacing: 0.8, marginHorizontal: 14, marginBottom: 8, marginTop: 4,
  },
  entryCard: {
    marginHorizontal: 14, marginBottom: 8,
    backgroundColor: T.surface, borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: T.border,
  },
  entryCardSynced: { opacity: 0.6 },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  entryType: { color: T.text, fontSize: 13, fontWeight: '600', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgePending: { backgroundColor: 'rgba(245,158,11,0.10)' },
  badgeSynced: { backgroundColor: T.greenDim },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextPending: { color: T.warning },
  badgeTextSynced: { color: T.green },
  entrySite: { color: T.text2, fontSize: 12 },
  entryDate: { color: T.text3, fontSize: 11, marginTop: 2 },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: T.border, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: { fontSize: 22, color: T.text3 },
  emptyText: { color: T.text2, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptySubText: { color: T.text3, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
