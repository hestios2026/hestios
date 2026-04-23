import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import LocationPicker, { type LocationPoint } from './LocationPicker';
import { T } from '../theme';
import { useLang } from '../i18n';

export { LocationPoint };

// ─── TextField ────────────────────────────────────────────────────────────────

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  hint?: string;
}

export function TextField({
  label, value, onChangeText, placeholder, required, multiline, numberOfLines, keyboardType = 'default', hint,
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
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

interface DropdownProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}

export function Dropdown({ label, value, options, onChange, required, placeholder }: DropdownProps) {
  const { tr } = useLang();
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <Text style={[styles.dropdownText, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder ?? tr.selectPlaceholder}
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

// ─── Location helpers ─────────────────────────────────────────────────────────

/**
 * Stored format: "Street Name Nr. | lat,lng"
 * If GPS was not used, just the address text is stored.
 */
export function parsePoint(v: string): LocationPoint | undefined {
  if (!v.trim()) return undefined;
  const pipeIdx = v.lastIndexOf('|');
  const coordStr = pipeIdx >= 0 ? v.slice(pipeIdx + 1) : v;
  const parts = coordStr.split(',').map(s => parseFloat(s.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return {
      lat: parts[0],
      lng: parts[1],
      label: pipeIdx >= 0 ? v.slice(0, pipeIdx).trim() : undefined,
    };
  }
  return undefined;
}

export function formatPoint(p: LocationPoint): string {
  const coords = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  return p.label ? `${p.label} | ${coords}` : coords;
}

/** Returns the human-readable part of a stored location value */
function displayAddress(v: string): string {
  const pipeIdx = v.lastIndexOf('|');
  return pipeIdx >= 0 ? v.slice(0, pipeIdx).trim() : v;
}

/** Returns coordinates string if present */
function displayCoords(v: string): string {
  const pipeIdx = v.lastIndexOf('|');
  return pipeIdx >= 0 ? v.slice(pipeIdx + 1).trim() : '';
}

// ─── LocationField ────────────────────────────────────────────────────────────

interface LocationFieldProps {
  label: string;
  mode: 'single' | 'route';
  startValue: string;
  stopValue?: string;
  waypointValues?: string[];
  onChangeStart: (v: string) => void;
  onChangeStop?: (v: string) => void;
  onChangeWaypoints?: (v: string[]) => void;
  required?: boolean;
}

export function LocationField({
  label, mode, startValue, stopValue, waypointValues,
  onChangeStart, onChangeStop, onChangeWaypoints, required,
}: LocationFieldProps) {
  const { tr } = useLang();
  const [showPicker, setShowPicker] = useState(false);

  const startCoords = displayCoords(startValue);
  const stopCoords  = stopValue ? displayCoords(stopValue) : '';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>

      {/* Start address input */}
      <TextInput
        style={styles.input}
        value={displayAddress(startValue)}
        onChangeText={text => onChangeStart(text)}
        placeholder={mode === 'route' ? tr.startPlaceholder : tr.singlePlaceholder}
        placeholderTextColor="#94A3B8"
      />
      {startCoords ? <Text style={styles.gpsCoords}>📍 {startCoords}</Text> : null}

      {/* Stop address input */}
      {mode === 'route' && (
        <>
          <TextInput
            style={[styles.input, { marginTop: 6 }]}
            value={displayAddress(stopValue ?? '')}
            onChangeText={text => onChangeStop?.(text)}
            placeholder={tr.stopPlaceholder}
            placeholderTextColor="#94A3B8"
          />
          {stopCoords ? <Text style={styles.gpsCoords}>📍 {stopCoords}</Text> : null}
        </>
      )}

      {/* Waypoints summary */}
      {mode === 'route' && waypointValues && waypointValues.length > 0 && (
        <View style={styles.waypointsBar}>
          {waypointValues.map((wp, idx) => (
            <View key={idx} style={styles.waypointChip}>
              <View style={styles.wpDot} />
              <Text style={styles.wpText} numberOfLines={1}>{displayAddress(wp) || `W${idx + 1}`}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Map button */}
      <TouchableOpacity style={styles.mapBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
        <Text style={styles.mapBtnTxt}>
          {mode === 'route' ? tr.mapBtnRoute : tr.mapBtnSingle}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <LocationPicker
          mode={mode}
          initialStart={parsePoint(startValue)}
          initialStop={mode === 'route' ? parsePoint(stopValue ?? '') : undefined}
          initialWaypoints={waypointValues?.map(parsePoint).filter(Boolean) as LocationPoint[]}
          onConfirm={result => {
            onChangeStart(formatPoint(result.start));
            if (mode === 'route' && result.stop) onChangeStop?.(formatPoint(result.stop));
            if (mode === 'route') onChangeWaypoints?.(result.waypoints?.map(formatPoint) ?? []);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: '700', color: T.text2,
    marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  required: { color: T.danger },
  input: {
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: T.text,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: T.text3, marginTop: 4 },
  gpsCoords: { fontSize: 10, color: T.text3, marginTop: 3, fontFamily: 'monospace', marginLeft: 2 },

  waypointsBar: { marginTop: 6, gap: 4 },
  waypointChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  wpDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f97316' },
  wpText: { fontSize: 12, color: '#c2410c', flex: 1, fontWeight: '500' },

  mapBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: 8, paddingVertical: 10,
  },
  mapBtnTxt: { fontSize: 13, color: T.green, fontWeight: '600' },

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
