import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import LocationPicker, { LocationPoint } from './LocationPicker';
import { T } from '../theme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  hint?: string;
}

export function TextField({
  label, value, onChangeText, placeholder, required, multiline, keyboardType = 'default', hint,
}: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        keyboardType={keyboardType}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

interface DropdownProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}

export function Dropdown({ label, value, options, onChange, required, placeholder }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <Text style={[styles.dropdownText, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder ?? 'Selectează...'}
        </Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.optionList}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.option, opt.value === value && styles.optionActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.optionText, opt.value === value && styles.optionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Location field ────────────────────────────────────────────────────────────

interface LocationFieldProps {
  label: string;
  mode: 'single' | 'route';
  startValue: string;
  stopValue?: string;
  onChangeStart: (v: string) => void;
  onChangeStop?: (v: string) => void;
  required?: boolean;
}

export function LocationField({ label, mode, startValue, stopValue, onChangeStart, onChangeStop, required }: LocationFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const parsePoint = (v: string): LocationPoint | undefined => {
    const parts = v.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
      return { lat: parts[0], lng: parts[1] };
    return undefined;
  };

  const formatPoint = (p: LocationPoint) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>

      {/* Manual text inputs */}
      <TextInput
        style={styles.input}
        value={startValue}
        onChangeText={onChangeStart}
        placeholder={mode === 'route' ? 'Start — STR. + NR.' : 'Locație — STR. + NR.'}
        placeholderTextColor="#94A3B8"
      />
      {mode === 'route' && (
        <TextInput
          style={[styles.input, { marginTop: 6 }]}
          value={stopValue ?? ''}
          onChangeText={onChangeStop}
          placeholder="Stop — STR. + NR."
          placeholderTextColor="#94A3B8"
        />
      )}

      {/* Map button */}
      <TouchableOpacity style={styles.mapBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
        <Text style={styles.mapBtnTxt}>
          {mode === 'route' ? '🗺  Marchează pe hartă' : '📍  Selectează pe hartă'}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <LocationPicker
          mode={mode}
          initialStart={parsePoint(startValue)}
          initialStop={mode === 'route' ? parsePoint(stopValue ?? '') : undefined}
          onConfirm={result => {
            onChangeStart(formatPoint(result.start));
            if (mode === 'route' && result.stop) onChangeStop?.(formatPoint(result.stop));
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, paddingVertical: 10,
  },
  mapBtnTxt: { fontSize: 13, color: T.green, fontWeight: '600' },
  field: { marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: '700', color: T.text2,
    marginBottom: 6, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  required: { color: T.danger },
  input: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: T.text,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: T.text3, marginTop: 4 },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11,
  },
  dropdownText: { fontSize: 14, color: T.text, flex: 1 },
  placeholder: { color: T.text3 },
  chevron: { color: T.text3, fontSize: 11 },
  optionList: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  option: {
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  optionActive: { backgroundColor: T.greenBg },
  optionText: { fontSize: 14, color: T.text },
  optionTextActive: { color: T.green, fontWeight: '600' },
});
