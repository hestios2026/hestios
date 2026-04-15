import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginWithPin } from '../api/auth';
import { T } from '../theme';
import { version } from '../../package.json';

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
      {/* Top accent line */}
      <View style={styles.accentLine} />

      <View style={styles.inner}>
        {/* Brand mark */}
        <View style={styles.brandWrap}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>H</Text>
          </View>
          <Text style={styles.appName}>HestiOS</Text>
          <Text style={styles.appSub}>Raportare Teren</Text>
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
  container: {
    flex: 1,
    backgroundColor: T.dark,
  },
  accentLine: {
    height: 2,
    backgroundColor: T.green,
    marginHorizontal: 40,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: 52,
  },
  logoMark: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: T.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: T.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  logoMarkText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  appName: {
    color: T.textLight,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSub: {
    color: T.text3,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  dots: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 48,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    borderColor: T.green,
    backgroundColor: T.green,
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 272,
    gap: 12,
    justifyContent: 'center',
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    color: T.textLight,
    fontSize: 26,
    fontWeight: '300',
  },
  keyDel: {
    color: T.text3,
    fontSize: 22,
  },
  hint: {
    color: T.text3,
    fontSize: 12,
    marginTop: 32,
    letterSpacing: 0.3,
  },
  versionText: {
    color: T.text3,
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 0.4,
  },
});
