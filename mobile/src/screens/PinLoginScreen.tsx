import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, SafeAreaView, Image, FlatList,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginWithPin, fetchMobileUsers, type MobileUser } from '../api/auth';
import { T } from '../theme';
import { version } from '../../package.json';

const ROLE_LABELS: Record<string, string> = {
  director: 'Director',
  projekt_leiter: 'Projekt Leiter',
  polier: 'Polier',
  sef_santier: 'Șef Șantier',
  callcenter: 'Call Center',
  aufmass: 'Aufmaß',
};

interface Props {
  onLogin: () => void;
}

export default function PinLoginScreen({ onLogin }: Props) {
  const [step, setStep] = useState<'select' | 'pin'>('select');
  const [users, setUsers] = useState<MobileUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<MobileUser | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMobileUsers()
      .then(setUsers)
      .catch(() => Alert.alert('Eroare', 'Nu s-a putut încărca lista de utilizatori.'))
      .finally(() => setLoadingUsers(false));
  }, []);

  const filteredUsers = search.trim()
    ? users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()))
    : users;

  const handleSelectUser = (user: MobileUser) => {
    setSelectedUser(user);
    setPin('');
    setStep('pin');
  };

  const handleKey = (key: string) => {
    if (key === 'del') {
      setPin(p => p.slice(0, -1));
    } else if (pin.length < 6) {
      const next = pin + key;
      setPin(next);
      if (next.length === 4 || next.length === 6) {
        submit(next);
      }
    }
  };

  const submit = async (value: string) => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const { token, user } = await loginWithPin(selectedUser.id, value);
      await AsyncStorage.setItem('hestios_token', token);
      await AsyncStorage.setItem('hestios_user', JSON.stringify(user));
      onLogin();
    } catch {
      Alert.alert('PIN incorect', 'Încearcă din nou.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];

  // ── Step 1: User selection ──────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accentLine} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo-mark.png')}
              style={styles.logoImageSmall}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.companyName}>HESTI ROSSMANN</Text>
              <Text style={styles.appSub}>Selectează utilizatorul</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Caută numele..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>

          {loadingUsers ? (
            <ActivityIndicator color={T.green} size="large" style={{ marginTop: 60 }} />
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {users.length === 0
                  ? 'Niciun utilizator cu PIN configurat.\nContactați administratorul.'
                  : 'Niciun rezultat.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={u => String(u.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userRow}
                  onPress={() => handleSelectUser(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.full_name}</Text>
                    <Text style={styles.userRole}>{ROLE_LABELS[item.role] ?? item.role}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </KeyboardAvoidingView>

        <Text style={styles.versionText}>v{version}</Text>
      </SafeAreaView>
    );
  }

  // ── Step 2: PIN entry ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.accentLine} />

      <View style={styles.inner}>
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => { setStep('select'); setPin(''); }}>
          <Text style={styles.backText}>‹ Înapoi</Text>
        </TouchableOpacity>

        {/* Selected user */}
        <View style={styles.brandWrap}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {selectedUser!.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
            </Text>
          </View>
          <Text style={styles.companyName}>{selectedUser!.full_name}</Text>
          <Text style={styles.appSub}>{ROLE_LABELS[selectedUser!.role] ?? selectedUser!.role}</Text>
        </View>

        {/* PIN dots */}
        <View style={styles.dots}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]}>
              {i < pin.length && <View style={styles.dotInner} />}
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={T.green} size="large" style={{ marginVertical: 40 }} />
        ) : (
          <View style={styles.keypad}>
            {keys.map((key, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.key, key === '' && styles.keyEmpty]}
                onPress={() => key !== '' && handleKey(key)}
                disabled={key === ''}
                activeOpacity={0.65}
              >
                {key === 'del' ? (
                  <Text style={styles.keyDel}>⌫</Text>
                ) : key !== '' ? (
                  <Text style={styles.keyText}>{key}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.hint}>Introdu PIN-ul de 4 cifre</Text>
        <Text style={styles.versionText}>v{version}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: T.dark },
  accentLine:  { height: 2, backgroundColor: T.green, marginHorizontal: 40, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },

  // Step 1 — user select
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  logoImageSmall: { width: 44, height: 44, borderRadius: 10 },
  companyName: { color: '#E8EDF5', fontSize: 15, fontWeight: '800', letterSpacing: 1.5 },
  appSub:      { color: T.text3, fontSize: 11, marginTop: 2, letterSpacing: 0.3 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon:  { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, height: 42, color: '#E8EDF5', fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { color: T.green, fontSize: 14, fontWeight: '700' },
  userName:    { color: '#E8EDF5', fontSize: 15, fontWeight: '600' },
  userRole:    { color: T.text3, fontSize: 11, marginTop: 2 },
  chevron:     { color: 'rgba(255,255,255,0.2)', fontSize: 22, lineHeight: 28 },
  separator:   { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 60 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText:   { color: T.text3, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Step 2 — PIN
  inner:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  backBtn:     { position: 'absolute', top: 12, left: 20 },
  backText:    { color: T.green, fontSize: 15, fontWeight: '600' },
  brandWrap:   { alignItems: 'center', marginBottom: 48 },
  avatarLarge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarLargeText: { color: T.green, fontSize: 24, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 18, marginBottom: 48 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  dotFilled:   { borderColor: T.green, backgroundColor: T.green },
  dotInner:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  keypad:      { flexDirection: 'row', flexWrap: 'wrap', width: 272, gap: 12, justifyContent: 'center' },
  key: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  keyEmpty:    { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText:     { color: T.textLight, fontSize: 26, fontWeight: '300' },
  keyDel:      { color: T.text3, fontSize: 22 },
  hint:        { color: T.text3, fontSize: 12, marginTop: 32, letterSpacing: 0.3 },
  versionText: { color: T.text3, fontSize: 11, marginTop: 8, letterSpacing: 0.4, textAlign: 'center', marginBottom: 8 },
});
