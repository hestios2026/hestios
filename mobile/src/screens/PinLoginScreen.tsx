import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginWithPin } from '../api/auth';

interface Props {
  onLogin: () => void;
}

export default function PinLoginScreen({ onLogin }: Props) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const { token, user } = await loginWithPin(value);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>HestiOS</Text>
          <Text style={styles.subtitle}>Raportare Teren</Text>
        </View>

        {/* Dots */}
        <View style={styles.dots}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled]}
            />
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#F97316" size="large" style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.keypad}>
            {keys.map((key, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.key, key === '' && styles.keyEmpty]}
                onPress={() => key !== '' && handleKey(key)}
                disabled={key === ''}
                activeOpacity={0.7}
              >
                {key === 'del' ? (
                  <Text style={styles.keyDel}>⌫</Text>
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.hint}>Introdu PIN-ul de 4 cifre</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    color: '#F1F5F9',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#475569',
    fontSize: 13,
    marginTop: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 48,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  dotFilled: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    gap: 12,
    justifyContent: 'center',
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
  },
  keyText: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '400',
  },
  keyDel: {
    color: '#94A3B8',
    fontSize: 22,
  },
  hint: {
    color: '#334155',
    fontSize: 12,
    marginTop: 32,
  },
});
