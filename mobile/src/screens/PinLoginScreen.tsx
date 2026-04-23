import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, SafeAreaView, FlatList,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginWithPin, fetchMobileUsers, type MobileUser } from '../api/auth';
import { T } from '../theme';
import { version } from '../../package.json';
import { useLang } from '../i18n';

interface Props { onLogin: () => void; }

export default function PinLoginScreen({ onLogin }: Props) {
  const { lang, setLang, tr } = useLang();
  const [step, setStep] = useState<'select' | 'pin'>('select');
  const [users, setUsers] = useState<MobileUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<MobileUser | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsers = () => {
    setLoadingUsers(true);
    setUsersError(false);
    fetchMobileUsers()
      .then(setUsers)
      .catch(() => setUsersError(true))
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => { loadUsers(); }, []);

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
      if (next.length === 4 || next.length === 6) submit(next);
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
      Alert.alert(tr.wrongPin, tr.wrongPinMsg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const initials = (name: string) =>
    name.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];

  const LangSwitcher = () => (
    <View style={S.langRow}>
      {(['ro','de'] as const).map(l => (
        <TouchableOpacity key={l} style={[S.langBtn, lang === l && S.langBtnOn]} onPress={() => setLang(l)}>
          <Text style={[S.langTxt, lang === l && S.langTxtOn]}>{l.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Step 1: User selection ────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <SafeAreaView style={S.root}>
        <View style={S.accentBar} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Header */}
          <View style={S.hdr}>
            <View style={S.logoWrap}>
              <View style={S.logoMark}><Text style={S.logoMarkTxt}>H</Text></View>
              <View>
                <Text style={S.appName}>HESTIOS</Text>
                <Text style={S.appSub}>Raportare</Text>
              </View>
            </View>
            <LangSwitcher />
          </View>

          {/* Search */}
          <View style={S.searchWrap}>
            <Text style={S.searchIco}>🔍</Text>
            <TextInput
              style={S.searchInput}
              placeholder={tr.searchPlaceholder}
              placeholderTextColor={T.text3}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>

          <Text style={S.secLabel}>Utilizatori activi</Text>

          {loadingUsers ? (
            <ActivityIndicator color={T.green} size="large" style={{ marginTop: 48 }} />
          ) : usersError ? (
            <View style={S.errWrap}>
              <Text style={S.errTxt}>{tr.usersLoadError}</Text>
              <TouchableOpacity style={S.retryBtn} onPress={loadUsers}>
                <Text style={S.retryTxt}>{tr.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={S.errWrap}>
              <Text style={S.errTxt}>{users.length === 0 ? tr.noPinUsers : tr.noResults}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={u => String(u.id)}
              contentContainerStyle={S.listContent}
              ItemSeparatorComponent={() => <View style={S.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={S.userRow} onPress={() => handleSelectUser(item)} activeOpacity={0.7}>
                  <View style={S.avatar}>
                    <Text style={S.avatarTxt}>{initials(item.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.userName}>{item.full_name}</Text>
                    <Text style={S.userRole}>{(tr.roleLabels as Record<string,string>)[item.role] ?? item.role}</Text>
                  </View>
                  <Text style={S.chevron}>›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </KeyboardAvoidingView>
        <Text style={S.version}>v{version}</Text>
      </SafeAreaView>
    );
  }

  // ── Step 2: PIN entry ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={S.root}>
      <View style={S.accentBar} />
      <View style={S.pinScreen}>
        {/* Back */}
        <View style={S.backRow}>
          <TouchableOpacity style={S.backBtn} onPress={() => { setStep('select'); setPin(''); }}>
            <Text style={S.backTxt}>← {tr.back.replace('‹ ', '')}</Text>
          </TouchableOpacity>
          <LangSwitcher />
        </View>

        {/* Avatar + name */}
        <View style={S.pinTop}>
          <View style={S.pinAvRing}>
            <Text style={S.pinAvTxt}>{initials(selectedUser!.full_name)}</Text>
          </View>
          <Text style={S.pinName}>{selectedUser!.full_name}</Text>
          <View style={S.rolePill}>
            <Text style={S.rolePillTxt}>{(tr.roleLabels as Record<string,string>)[selectedUser!.role] ?? selectedUser!.role}</Text>
          </View>
          <Text style={S.pinHint}>{tr.pinHint}</Text>
          <View style={S.dotsRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={[S.dot, i < pin.length && S.dotFilled]} />
            ))}
          </View>
        </View>

        {/* Spacer pushes keypad to bottom */}
        <View style={{ flex: 1 }} />

        {/* Keypad */}
        {loading ? (
          <ActivityIndicator color={T.green} size="large" style={{ marginBottom: 40 }} />
        ) : (
          <View style={S.keypad}>
            {KEYS.map((key, idx) => (
              <TouchableOpacity
                key={idx}
                style={[S.key, key === '' && S.keyEmpty, key === 'del' && S.keyDel]}
                onPress={() => key !== '' && handleKey(key)}
                disabled={key === ''}
                activeOpacity={0.6}
              >
                {key === 'del' ? (
                  <Text style={S.keyDelTxt}>⌫</Text>
                ) : key !== '' ? (
                  <Text style={S.keyTxt}>{key}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={S.version}>v{version}</Text>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:       { flex: 1, backgroundColor: T.dark },
  accentBar:  { height: 2, backgroundColor: T.green, marginHorizontal: 40, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },

  // Header
  hdr:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.borderDk },
  logoWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark:   { width: 34, height: 34, borderRadius: 9, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center' },
  logoMarkTxt:{ color: '#fff', fontSize: 16, fontWeight: '900' },
  appName:    { color: T.textLight, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  appSub:     { color: T.text3, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 1 },

  // Lang
  langRow:    { flexDirection: 'row', gap: 5 },
  langBtn:    { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: T.borderDk, backgroundColor: 'rgba(255,255,255,0.04)' },
  langBtnOn:  { borderColor: T.green, backgroundColor: 'rgba(34,197,94,0.1)' },
  langTxt:    { color: T.text3, fontSize: 10, fontWeight: '800' },
  langTxtOn:  { color: T.green },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: T.borderDk },
  searchIco:  { fontSize: 13 },
  searchInput:{ flex: 1, height: 42, color: T.textLight, fontSize: 13 },

  // Section
  secLabel:   { paddingHorizontal: 16, paddingBottom: 6, fontSize: 9, fontWeight: '800', color: T.text3, letterSpacing: 1.4, textTransform: 'uppercase' },

  // User list
  listContent:{ paddingHorizontal: 14, paddingBottom: 20 },
  sep:        { height: 4 },
  userRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: T.borderDk },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { color: T.green, fontSize: 13, fontWeight: '800' },
  userName:   { color: T.textLight, fontSize: 14, fontWeight: '700' },
  userRole:   { color: T.text3, fontSize: 11, marginTop: 2 },
  chevron:    { color: T.text3, fontSize: 22, lineHeight: 28 },

  // Error / retry
  errWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  errTxt:     { color: T.text3, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn:   { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: T.green, backgroundColor: 'rgba(34,197,94,0.08)' },
  retryTxt:   { color: T.green, fontSize: 14, fontWeight: '700' },

  // PIN screen
  pinScreen:  { flex: 1, flexDirection: 'column' },
  backRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  backTxt:    { color: T.green, fontSize: 12, fontWeight: '700' },

  pinTop:     { alignItems: 'center', paddingTop: 16 },
  pinAvRing:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 2, borderColor: 'rgba(34,197,94,0.35)', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  pinAvTxt:   { color: T.green, fontSize: 22, fontWeight: '900' },
  pinName:    { color: T.textLight, fontSize: 18, fontWeight: '800', marginTop: 12 },
  rolePill:   { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.borderDk, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 14 },
  rolePillTxt:{ color: T.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  pinHint:    { color: T.text3, fontSize: 12, marginTop: 20 },
  dotsRow:    { flexDirection: 'row', gap: 16, marginTop: 14 },
  dot:        { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.04)' },
  dotFilled:  { backgroundColor: T.green, borderColor: T.green },

  // Keypad
  keypad:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 24, paddingBottom: 12, gap: 12, justifyContent: 'center' },
  key:        { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  keyEmpty:   { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyDel:     { backgroundColor: 'rgba(255,255,255,0.04)' },
  keyTxt:     { color: T.textLight, fontSize: 26, fontWeight: '300' },
  keyDelTxt:  { color: T.text3, fontSize: 22 },

  version:    { color: T.text3, fontSize: 11, textAlign: 'center', paddingBottom: 10, letterSpacing: 0.3 },
});
