import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { BackHandler, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import PinLoginScreen from './src/screens/PinLoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import WorkTypeSelectorScreen from './src/screens/WorkTypeSelectorScreen';
import ReportFormScreen from './src/screens/ReportFormScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import PontajScreen from './src/screens/PontajScreen';
import ProgramariScreen from './src/screens/ProgramariScreen';
import { LangProvider } from './src/i18n';
import { getQueue, syncQueue } from './src/store/offlineQueue';
import { getPontajQueue, syncPontajQueue } from './src/store/pontajQueue';
import type { WorkType, WorkEntry } from './src/types';

type Screen = 'login' | 'home' | 'type-select' | 'form' | 'detail' | 'pontaj' | 'programari';

interface ReportContext {
  siteId: number;
  siteName: string;
  nvtNumber: string;
  workType?: WorkType;
}

function AppInner() {
  const [screen, setScreen] = useState<Screen>('login');
  const [ctx, setCtx] = useState<ReportContext>({ siteId: 0, siteName: '', nvtNumber: '' });
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('hestios_token').then(token => {
      if (token) setScreen('home');
    });
  }, []);

  // Silent sync helper — runs both queues if online
  const runAutoSync = async () => {
    try {
      const net = await Network.getNetworkStateAsync();
      if (!net.isConnected) return;
      const [queue, pontajQ] = await Promise.all([getQueue(), getPontajQueue()]);
      if (queue.some(e => !e.synced))   syncQueue().catch(() => {});
      if (pontajQ.some(p => !p.synced)) syncPontajQueue().catch(() => {});
    } catch {}
  };

  // Auto-sync on foreground + token check
  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active') return;
      const token = await AsyncStorage.getItem('hestios_token');
      if (!token) { setScreen('login'); return; }
      runAutoSync();
    });
    return () => sub.remove();
  }, []);

  // Auto-sync when network comes back online while app is open
  useEffect(() => {
    let lastOnline = true;
    const interval = setInterval(async () => {
      try {
        const net = await Network.getNetworkStateAsync();
        const online = !!net.isConnected;
        if (online && !lastOnline) runAutoSync();
        lastOnline = online;
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'detail')      { setScreen('home');        return true; }
      if (screen === 'form')        { setScreen('type-select'); return true; }
      if (screen === 'type-select') { setScreen('home');        return true; }
      if (screen === 'pontaj')      { setScreen('home');        return true; }
      if (screen === 'programari')  { setScreen('home');        return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  const handleLogin = () => setScreen('home');

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['hestios_token', 'hestios_user']);
    setScreen('login');
  };

  const handleAddReport = (siteId: number, siteName: string, nvtNumber: string) => {
    setCtx({ siteId, siteName, nvtNumber });
    setScreen('type-select');
  };

  const handlePontaj = (siteId: number, siteName: string) => {
    setCtx(c => ({ ...c, siteId, siteName }));
    setScreen('pontaj');
  };

  const handleProgramari = (siteId: number) => {
    setCtx(c => ({ ...c, siteId }));
    setScreen('programari');
  };

  const handleSelectType = (workType: WorkType) => {
    setCtx(c => ({ ...c, workType }));
    setScreen('form');
  };

  const handleDetail = (entry: WorkEntry) => {
    setSelectedEntry(entry);
    setScreen('detail');
  };

  switch (screen) {
    case 'login':
      return (
        <>
          <StatusBar style="light" />
          <PinLoginScreen onLogin={handleLogin} />
        </>
      );
    case 'home':
      return (
        <>
          <StatusBar style="light" />
          <HomeScreen
            onAddReport={handleAddReport}
            onLogout={handleLogout}
            onPontaj={handlePontaj}
            onProgramari={handleProgramari}
            onDetail={handleDetail}
          />
        </>
      );
    case 'type-select':
      return (
        <>
          <StatusBar style="light" />
          <WorkTypeSelectorScreen
            siteId={ctx.siteId}
            siteName={ctx.siteName}
            nvtNumber={ctx.nvtNumber}
            onSelect={handleSelectType}
            onBack={() => setScreen('home')}
          />
        </>
      );
    case 'form':
      return (
        <>
          <StatusBar style="light" />
          <ReportFormScreen
            workType={ctx.workType!}
            siteId={ctx.siteId}
            siteName={ctx.siteName}
            nvtNumber={ctx.nvtNumber}
            onBack={() => setScreen('type-select')}
            onSaved={() => setScreen('home')}
          />
        </>
      );
    case 'detail':
      return (
        <>
          <StatusBar style="light" />
          <ReportDetailScreen
            entry={selectedEntry!}
            onBack={() => setScreen('home')}
          />
        </>
      );
    case 'pontaj':
      return (
        <>
          <StatusBar style="light" />
          <PontajScreen
            siteId={ctx.siteId}
            siteName={ctx.siteName}
            onBack={() => setScreen('home')}
          />
        </>
      );
    case 'programari':
      return (
        <>
          <StatusBar style="light" />
          <ProgramariScreen
            siteId={ctx.siteId || undefined}
            onBack={() => setScreen('home')}
          />
        </>
      );
  }
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}
