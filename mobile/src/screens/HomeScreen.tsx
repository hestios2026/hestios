import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, SafeAreaView, RefreshControl, TextInput, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { fetchSites } from '../api/auth';
import { fetchMobileVersion } from '../api/version';
import { getQueue, syncQueue, clearSynced } from '../store/offlineQueue';
import type { AuthUser, Site, WorkEntry } from '../types';
import { T } from '../theme';
import { useLang } from '../i18n';

// Keep in sync with package.json version and android/app/build.gradle versionCode
import { version as CURRENT_VERSION } from '../../package.json';

interface Props {
  onAddReport: (siteId: number, siteName: string, nvtNumber: string) => void;
  onLogout: () => void;
  onPontaj: (siteId: number, siteName: string) => void;
  onProgramari: (siteId: number) => void;
  onDetail: (entry: WorkEntry) => void;
}

function initials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function HomeScreen({ onAddReport, onLogout, onPontaj, onProgramari, onDetail }: Props) {
  const { tr } = useLang();
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
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);

  useEffect(() => { loadData(); checkForUpdate(); }, []);

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
          setSelectedSite(siteList.find((s: Site) => s.id === saved.id) ?? saved);
        }
      } catch {
        const cached = await AsyncStorage.getItem('hestios_sites_cache');
        if (cached) {
          const siteList = JSON.parse(cached);
          setSites(siteList);
          if (savedSiteRaw) setSelectedSite(JSON.parse(savedSiteRaw));
        } else {
          Alert.alert(tr.connectionError, tr.serverConnectError);
        }
      }

      const q = await getQueue();
      setQueue(q.reverse());
    } finally {
      setLoading(false);
    }
  };

  const checkForUpdate = async () => {
    try {
      const remote = await fetchMobileVersion();
      if (remote.mobile_version_name && remote.mobile_version_name !== CURRENT_VERSION) {
        setUpdateUrl(remote.mobile_download_url);
      }
    } catch {
      // Silently ignore — no update info when offline
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
      Alert.alert(tr.syncComplete, tr.syncResult(synced, failed, lastError));
      const q = await getQueue();
      setQueue(q.reverse());
    } catch (err: any) {
      Alert.alert(tr.syncError, err?.message ?? String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleClearQueue = () => {
    const syncedCount = queue.filter(e => e.synced).length;
    const pendingCount2 = queue.filter(e => !e.synced).length;
    Alert.alert(
      tr.clearQueueTitle,
      syncedCount > 0 ? tr.clearSyncedMsg(syncedCount, pendingCount2) : tr.clearQueueMsg,
      [
        { text: tr.cancel, style: 'cancel' },
        ...(syncedCount > 0 ? [{
          text: tr.deleteSynced,
          onPress: async () => {
            await clearSynced();
            const q = await getQueue();
            setQueue(q.reverse());
          },
        }] : []),
        {
          text: tr.deleteAll, style: 'destructive' as const,
          onPress: async () => {
            await AsyncStorage.removeItem('hestios_offline_queue');
            setQueue([]);
          },
        },
      ],
    );
  };

  const handleAddReport = () => {
    if (!selectedSite) { Alert.alert(tr.selectProjectTitle, tr.selectProjectBeforeReport); return; }
    onAddReport(selectedSite.id, selectedSite.name, nvtNumber);
  };

  const handlePontaj = () => {
    if (!selectedSite) { Alert.alert(tr.selectProjectTitle, tr.selectProjectBeforePontaj); return; }
    onPontaj(selectedSite.id, selectedSite.name);
  };

  const pendingCount = queue.filter(e => !e.synced).length;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  if (loading) {
    return <View style={S.center}><ActivityIndicator color={T.green} size="large" /></View>;
  }

  return (
    <SafeAreaView style={S.root}>
      {/* Header */}
      <View style={S.hdr}>
        <View style={S.hdrLeft}>
          <View style={S.avatar}>
            <Text style={S.avatarTxt}>{user ? initials(user.full_name) : '?'}</Text>
          </View>
          <View>
            <Text style={S.greeting}>{user?.full_name?.split(' ')[0] ? `Bună, ${user.full_name.split(' ')[0]}` : 'Bun venit'}</Text>
            <View style={S.statusRow}>
              <View style={[S.statusDot, { backgroundColor: isOnline ? T.green : T.danger }]} />
              <Text style={S.statusTxt}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={S.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
          <Text style={S.logoutTxt}>{tr.logout}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={queue}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.green} />}
        ListHeaderComponent={(
          <View>
            {/* Site card */}
            <View style={S.siteCard}>
              <Text style={S.fieldLabel}>{tr.projectSite}</Text>
              <TouchableOpacity
                style={[S.selector, sitePickerOpen && S.selectorOpen]}
                onPress={() => setSitePickerOpen(!sitePickerOpen)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  {selectedSite ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={S.kstBadge}><Text style={S.kstTxt}>{selectedSite.kst}</Text></View>
                      <Text style={S.siteName}>{selectedSite.name}</Text>
                    </View>
                  ) : (
                    <Text style={S.selectorPh}>{tr.selectSite}</Text>
                  )}
                </View>
                <Text style={S.chevron}>{sitePickerOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {sitePickerOpen && (
                <View style={S.dropList}>
                  {sites.map(site => {
                    const active = selectedSite?.id === site.id;
                    return (
                      <TouchableOpacity
                        key={site.id}
                        style={[S.dropItem, active && S.dropItemActive]}
                        onPress={() => handleSelectSite(site)}
                        activeOpacity={0.7}
                      >
                        <Text style={[S.dropKst, active && S.dropActive]}>{site.kst}</Text>
                        <Text style={[S.dropName, active && S.dropActive]}>{site.name}</Text>
                        {active && <View style={S.checkDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[S.fieldLabel, { marginTop: 14 }]}>{tr.nvtLabel}</Text>
              <TextInput
                style={S.nvtInput}
                value={nvtNumber}
                onChangeText={v => { setNvtNumber(v); AsyncStorage.setItem('hestios_nvt_number', v); }}
                placeholder={tr.nvtPlaceholder}
                placeholderTextColor={T.text3}
                autoCapitalize="characters"
                returnKeyType="done"
              />
            </View>

            {/* Update banner */}
            {updateUrl && (
              <TouchableOpacity
                style={S.updateBanner}
                onPress={() => Linking.openURL(updateUrl)}
                activeOpacity={0.85}
              >
                <Text style={S.updateIco}>⬆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.updateTitle}>Actualizare disponibilă</Text>
                  <Text style={S.updateSub}>Apasă pentru a descărca versiunea nouă</Text>
                </View>
                <Text style={S.updateArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Sync banner */}
            {pendingCount > 0 && (
              <View style={S.syncRow}>
                <TouchableOpacity
                  style={[S.syncBanner, !isOnline && S.syncBannerOffline, { flex: 1 }]}
                  onPress={isOnline ? handleSync : undefined}
                  activeOpacity={isOnline ? 0.8 : 1}
                >
                  {syncing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <View style={S.syncDot} />
                      <Text style={S.syncTxt}>
                        {isOnline ? tr.pending(pendingCount) : tr.pendingOffline(pendingCount)}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={S.clearBtn} onPress={handleClearQueue} activeOpacity={0.8}>
                  <Text style={{ fontSize: 16 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Action grid */}
            <View style={S.actGrid}>
              <TouchableOpacity style={[S.actTile, S.actPrimary]} onPress={handleAddReport} activeOpacity={0.85}>
                <Text style={S.actIco}>📋</Text>
                <Text style={[S.actLbl, { color: '#fff' }]}>{tr.addReport}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.actTile, S.actDark]} onPress={handlePontaj} activeOpacity={0.85}>
                <Text style={S.actIco}>⏱</Text>
                <Text style={[S.actLbl, { color: T.text2 }]}>{tr.teamAttendance}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.actTile, S.actDark]} onPress={() => onProgramari(selectedSite?.id ?? 0)} activeOpacity={0.85}>
                <Text style={S.actIco}>📅</Text>
                <Text style={[S.actLbl, { color: T.text2 }]}>{tr.appointments}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.actTile, S.actAccent]} onPress={isOnline ? handleSync : undefined} activeOpacity={0.85}>
                <Text style={S.actIco}>🔄</Text>
                <Text style={[S.actLbl, { color: T.green }]}>Sincronizare</Text>
                {pendingCount > 0 && (
                  <View style={S.actBadge}><Text style={S.actBadgeTxt}>{pendingCount}</Text></View>
                )}
              </TouchableOpacity>
            </View>

            {queue.length > 0 && (
              <Text style={S.secLabel}>{tr.localReports}</Text>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[S.entryCard, item.synced ? S.entryCardSynced : S.entryCardPending]}
            onPress={() => onDetail(item)}
            activeOpacity={0.75}
          >
            <View style={S.entryRow}>
              <Text style={S.entryType}>{tr.workTypeLabels[item.work_type]}</Text>
              <View style={[S.badge, item.synced ? S.badgeSynced : S.badgePending]}>
                <View style={[S.badgeDot, { backgroundColor: item.synced ? T.green : T.warning }]} />
                <Text style={[S.badgeTxt, { color: item.synced ? T.green : T.warning }]}>
                  {item.synced ? '✓ Sync' : 'Pending'}
                </Text>
              </View>
            </View>
            <Text style={S.entrySite}>{item.site_name}{item.nvt_number ? ` — ${item.nvt_number}` : ''}</Text>
            <Text style={S.entryDate}>{fmtDate(item.created_at)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={(
          <View style={S.empty}>
            <Text style={S.emptyIco}>📋</Text>
            <Text style={S.emptyTxt}>{tr.noLocalReports}</Text>
            <Text style={S.emptySubTxt}>{tr.noLocalReportsSub}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.dark },

  // Header
  hdr:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: T.darkCard, borderBottomWidth: 1, borderBottomColor: T.borderDk },
  hdrLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { color: T.green, fontSize: 12, fontWeight: '800' },
  greeting:   { color: T.textLight, fontSize: 14, fontWeight: '700' },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusTxt:  { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
  logoutBtn:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: T.borderDk },
  logoutTxt:  { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '500' },

  // Site card
  siteCard:   { margin: 14, backgroundColor: T.darkCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: T.borderDk },
  fieldLabel: { fontSize: 9, fontWeight: '800', color: T.text3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  selector:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.borderDk, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.03)' },
  selectorOpen:{ borderColor: T.green },
  kstBadge:   { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  kstTxt:     { color: T.green, fontSize: 10, fontWeight: '800' },
  siteName:   { color: T.textLight, fontSize: 13, fontWeight: '600' },
  selectorPh: { color: T.text3, fontSize: 13 },
  chevron:    { color: T.text3, fontSize: 10, marginLeft: 8 },

  dropList:     { marginTop: 4, borderWidth: 1, borderColor: T.borderDk, borderRadius: 9, overflow: 'hidden', backgroundColor: T.darkCard },
  dropItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.borderDk },
  dropItemActive:{ backgroundColor: 'rgba(34,197,94,0.07)' },
  dropKst:      { color: T.text3, fontSize: 10, width: 40, fontWeight: '700' },
  dropName:     { color: T.textLight, fontSize: 12, flex: 1 },
  dropActive:   { color: T.green, fontWeight: '700' },
  checkDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: T.green },

  nvtInput:   { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: T.borderDk, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: T.textLight },

  // Update banner
  updateBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginBottom: 10, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  updateIco:    { fontSize: 18, color: T.green },
  updateTitle:  { color: T.green, fontSize: 13, fontWeight: '700' },
  updateSub:    { color: 'rgba(34,197,94,0.65)', fontSize: 11, marginTop: 1 },
  updateArrow:  { color: T.green, fontSize: 22, fontWeight: '300' },

  // Sync
  syncRow:    { flexDirection: 'row', marginHorizontal: 14, marginBottom: 10, gap: 8 },
  syncBanner: { backgroundColor: T.green, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncBannerOffline: { backgroundColor: T.warning },
  syncDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  syncTxt:    { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  clearBtn:   { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 9, width: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.borderDk },

  // Action grid
  actGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, marginBottom: 10, gap: 10 },
  actTile:    { width: '47%', borderRadius: 12, padding: 14, gap: 6, position: 'relative' },
  actPrimary: { backgroundColor: T.green, elevation: 6 },
  actDark:    { backgroundColor: T.darkCard, borderWidth: 1, borderColor: T.borderDk },
  actAccent:  { backgroundColor: T.darkCard, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  actIco:     { fontSize: 20, lineHeight: 24 },
  actLbl:     { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  actBadge:   { position: 'absolute', top: 8, right: 8, backgroundColor: T.warning, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  actBadgeTxt:{ fontSize: 9, fontWeight: '800', color: '#fff' },

  // Section label
  secLabel:   { fontSize: 9, fontWeight: '800', color: T.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginHorizontal: 14, marginBottom: 8, marginTop: 4 },

  // Entry cards
  entryCard:       { marginHorizontal: 14, marginBottom: 8, backgroundColor: T.darkCard, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: T.borderDk, borderLeftWidth: 3 },
  entryCardPending:{ borderLeftColor: T.warning },
  entryCardSynced: { borderLeftColor: T.green, opacity: 0.65 },
  entryRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  entryType:       { color: T.textLight, fontSize: 13, fontWeight: '700', flex: 1 },
  badge:           { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgePending:    { backgroundColor: 'rgba(245,158,11,0.1)' },
  badgeSynced:     { backgroundColor: 'rgba(34,197,94,0.1)' },
  badgeDot:        { width: 5, height: 5, borderRadius: 3 },
  badgeTxt:        { fontSize: 10, fontWeight: '700' },
  entrySite:       { color: T.text2, fontSize: 12 },
  entryDate:       { color: T.text3, fontSize: 11, marginTop: 2 },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyIco:   { fontSize: 40, marginBottom: 14 },
  emptyTxt:   { color: T.text2, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptySubTxt:{ color: T.text3, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
