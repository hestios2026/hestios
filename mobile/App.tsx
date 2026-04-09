import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { BackHandler, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PinLoginScreen from './src/screens/PinLoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import WorkTypeSelectorScreen from './src/screens/WorkTypeSelectorScreen';
import ReportFormScreen from './src/screens/ReportFormScreen';
import PontajScreen from './src/screens/PontajScreen';
import ProgramariScreen from './src/screens/ProgramariScreen';
import type { WorkType } from './src/types';

type Screen = 'login' | 'home' | 'type-select' | 'form' | 'pontaj' | 'programari';

interface ReportContext {
  siteId: number;
  siteName: string;
  nvtNumber: string;
  workType?: WorkType;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [ctx, setCtx] = useState<ReportContext>({ siteId: 0, siteName: '', nvtNumber: '' });

  useEffect(() => {
    AsyncStorage.getItem('hestios_token').then(token => {
      if (token) setScreen('home');
    });
  }, []);

  // Re-check token whenever app comes to foreground (catches mid-session expiry cleared by interceptor)
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        AsyncStorage.getItem('hestios_token').then(token => {
          if (!token) setScreen('login');
        });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'form') { setScreen('type-select'); return true; }
      if (screen === 'type-select') { setScreen('home'); return true; }
      if (screen === 'pontaj') { setScreen('home'); return true; }
      if (screen === 'programari') { setScreen('home'); return true; }
      return false; // default behavior (exit app) on home/login
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

  const handleProgramari = () => setScreen('programari');

  const handleSelectType = (workType: WorkType) => {
    setCtx(c => ({ ...c, workType }));
    setScreen('form');
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
          <HomeScreen onAddReport={handleAddReport} onLogout={handleLogout} onPontaj={handlePontaj} onProgramari={handleProgramari} />
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
          <ProgramariScreen onBack={() => setScreen('home')} />
        </>
      );
  }
}
