import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TextField, Dropdown, LocationField } from '../components/FormField';
import PhotoPicker from '../components/PhotoPicker';
import { enqueue } from '../store/offlineQueue';
import { newUUID } from '../utils/timestamp';
import type {
  WorkType, AuthUser, PhotoEntry,
  DataPozeInainte, DataTeratest, DataSemneCirculatie, DataLieferScheine,
  DataMontajNvtPdp, DataHpPlus, DataHA, DataReparatie, DataTrasTeava,
  DataGroapa, DataTraversare, DataSapatura, DataRaportZilnic,
} from '../types';
import { WORK_TYPE_LABELS } from '../types';

interface Props {
  workType: WorkType;
  siteId: number;
  siteName: string;
  nvtNumber: string;
  onBack: () => void;
  onSaved: () => void;
}

export default function ReportFormScreen({
  workType, siteId, siteName, nvtNumber, onBack, onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);

  // ─── Per-type state ───────────────────────────────────────────────────────

  // A — Poze Înainte
  const [pozeData, setPozeData] = useState<DataPozeInainte>({
    tip: '', start: '', stop: '', photos: [],
  });

  // B — Teratest
  const [teraData, setTeraData] = useState<DataTeratest>({
    moment: '', photos: [],
  });

  // C — Semne Circulatie
  const [semneData, setSemneData] = useState<DataSemneCirculatie>({
    start: '', stop: '', photos: [],
  });

  // D — Liefer Scheine
  const [lieferData, setLieferData] = useState<DataLieferScheine>({
    descriere: '', photos: [],
  });

  // E — Montaj NVT/PDP
  const [montajData, setMontajData] = useState<DataMontajNvtPdp>({
    locatie: '', photos: [],
  });

  // F — HP+
  const [hpData, setHpData] = useState<DataHpPlus>({
    locatie: '', photos: [],
  });

  // G — HA
  const [haData, setHaData] = useState<DataHA>({
    locatie: '', tip_conectare: '', suprafata: '', suprafata_mixt_detalii: '', photos: [],
  });

  // H — Reparatie
  const [repData, setRepData] = useState<DataReparatie>({
    locatie: '', descriere: '', photos: [],
  });

  // I — Tras Teava
  const [trasData, setTrasData] = useState<DataTrasTeava>({
    start: '', stop: '', nr_cabluri: '', lungime: '', photos: [],
  });

  // J — Groapa
  const [groapaData, setGroapaData] = useState<DataGroapa>({
    locatie: '', terasament: '', grosime_asfalt: '', lungime: '', latime: '', adancime: '', photos: [],
  });

  // K — Traversare
  const [traversareData, setTraversareData] = useState<DataTraversare>({
    start: '', stop: '', lungime: '', latime: '', adancime: '', terasament: '',
    grosime_asfalt: '', nr_cabluri: '', teava_protectie: '', photos: [],
  });

  // L — Sapatura
  const [sapaturaData, setSapaturaData] = useState<DataSapatura>({
    start: '', stop: '', terasament: '', grosime_asfalt: '', lungime: '',
    latime: '', adancime: '', tip: '', nr_cabluri: '', photos: [],
  });

  // M — Raport Zilnic
  const [raportData, setRaportData] = useState<DataRaportZilnic>({
    lungime_totala: '', nr_bransamente_ha: '', nr_hp_plus: '',
    locatie_start: '', locatie_stop: '', photos: [],
  });

  // ─── Validation ────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    switch (workType) {
      case 'poze_inainte':
        if (!pozeData.tip) return 'Selectează tipul (Public/Privat).';
        if (!pozeData.start) return 'Introduceți locația Start.';
        break;
      case 'teratest':
        if (!teraData.moment) return 'Selectează momentul (Înainte/După).';
        break;
      case 'liefer_scheine':
        if (lieferData.photos.length === 0) return 'Adaugă cel puțin o poză.';
        break;
      case 'montaj_nvt_pdp':
        if (!montajData.locatie) return 'Introduceți locația.';
        if (montajData.photos.length < 4) return 'Minim 4 poze necesare.';
        break;
      case 'hp_plus':
        if (!hpData.locatie) return 'Introduceți locația (STR. + NR.).';
        if (hpData.photos.length < 2) return 'Minim 2 poze necesare.';
        break;
      case 'ha':
        if (!haData.locatie) return 'Introduceți locația (STR. + NR.).';
        if (!haData.tip_conectare) return 'Selectează tipul de conectare.';
        if (!haData.suprafata) return 'Selectează suprafața.';
        if (haData.photos.length < 5) return 'Minim 5 poze necesare.';
        break;
      case 'reparatie':
        if (!repData.locatie) return 'Introduceți locația.';
        if (!repData.descriere) return 'Descrierea este obligatorie.';
        break;
      case 'tras_teava':
        if (!trasData.start) return 'Introduceți locația Start.';
        if (!trasData.nr_cabluri) return 'Nr. de cabluri este obligatoriu.';
        if (!trasData.lungime) return 'Lungimea este obligatorie.';
        break;
      case 'groapa':
        if (!groapaData.locatie) return 'Introduceți locația.';
        if (!groapaData.terasament) return 'Selectează terasamentul.';
        if (groapaData.terasament === 'asfalt' && !groapaData.grosime_asfalt)
          return 'Grosimea asfaltului este obligatorie.';
        if (groapaData.photos.length < 3) return 'Minim 3 poze necesare.';
        break;
      case 'traversare':
        if (!traversareData.start) return 'Introduceți Start.';
        if (!traversareData.nr_cabluri) return 'Nr. cabluri montate este obligatoriu.';
        if (traversareData.photos.length < 4) return 'Minim 4 poze necesare.';
        break;
      case 'sapatura':
        if (!sapaturaData.start) return 'Introduceți Start.';
        if (!sapaturaData.nr_cabluri) return 'Nr. cabluri montate este obligatoriu.';
        if (!sapaturaData.tip) return 'Selectează tipul săpăturii.';
        break;
      case 'raport_zilnic':
        if (!raportData.lungime_totala) return 'Lungimea totală este obligatorie.';
        if (!raportData.locatie_start) return 'Locația Start este obligatorie.';
        if (!raportData.locatie_stop) return 'Locația Stop este obligatorie.';
        if (raportData.photos.length < 5) return 'Minim 5 poze necesare.';
        break;
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) { Alert.alert('Câmpuri incomplete', error); return; }

    setSaving(true);
    try {
      const userRaw = await AsyncStorage.getItem('hestios_user');
      const user: AuthUser = userRaw ? JSON.parse(userRaw) : { id: 0, full_name: 'Unknown' };

      const dataMap: Record<WorkType, any> = {
        poze_inainte: pozeData,
        teratest: teraData,
        semne_circulatie: semneData,
        liefer_scheine: lieferData,
        montaj_nvt_pdp: montajData,
        hp_plus: hpData,
        ha: haData,
        reparatie: repData,
        tras_teava: trasData,
        groapa: groapaData,
        traversare: traversareData,
        sapatura: sapaturaData,
        raport_zilnic: raportData,
      };

      await enqueue({
        id: newUUID(),
        site_id: siteId,
        site_name: siteName,
        nvt_number: nvtNumber,
        work_type: workType,
        created_by: user.id,
        created_by_name: user.full_name,
        created_at: new Date().toISOString(),
        synced: false,
        data: dataMap[workType],
      });

      Alert.alert('Salvat', 'Raportul a fost salvat local și va fi sincronizat când ai internet.', [
        { text: 'OK', onPress: onSaved },
      ]);
    } finally {
      setSaving(false);
    }
  };

  // ─── Form renderers ────────────────────────────────────────────────────────

  const renderForm = () => {
    switch (workType) {

      // A — Poze Înainte
      case 'poze_inainte':
        return (
          <>
            <Dropdown label="Tip" value={pozeData.tip} required
              options={[{ value: 'public', label: 'Public' }, { value: 'privat', label: 'Privat' }]}
              onChange={v => setPozeData(p => ({ ...p, tip: v as any }))}
            />
            <LocationField label="Locație" mode="route" required
              startValue={pozeData.start} stopValue={pozeData.stop}
              onChangeStart={v => setPozeData(p => ({ ...p, start: v }))}
              onChangeStop={v => setPozeData(p => ({ ...p, stop: v }))}
            />
            <PhotoPicker photos={pozeData.photos}
              onChange={ph => setPozeData(p => ({ ...p, photos: ph }))}
            />
          </>
        );

      // B — Teratest
      case 'teratest':
        return (
          <>
            <Dropdown label="Moment" value={teraData.moment} required
              options={[
                { value: 'inainte_sapatura', label: 'Înainte de Săpătură' },
                { value: 'dupa_umplere', label: 'După Săp. + Umplutură' },
              ]}
              onChange={v => setTeraData(p => ({ ...p, moment: v as any }))}
            />
            <PhotoPicker photos={teraData.photos}
              onChange={ph => setTeraData(p => ({ ...p, photos: ph }))}
              label="Fotografii (selectează categoria la fiecare)"
            />
          </>
        );

      // C — Semne Circulație
      case 'semne_circulatie':
        return (
          <>
            <LocationField label="Locație tronson" mode="route" required
              startValue={semneData.start} stopValue={semneData.stop}
              onChangeStart={v => setSemneData(p => ({ ...p, start: v }))}
              onChangeStop={v => setSemneData(p => ({ ...p, stop: v }))}
            />
            <PhotoPicker photos={semneData.photos}
              onChange={ph => setSemneData(p => ({ ...p, photos: ph }))}
              minPhotos={6}
              label="Fotografii (minim 6 per tronson)"
            />
          </>
        );

      // D — Liefer Scheine
      case 'liefer_scheine':
        return (
          <>
            <TextField label="Descriere" value={lieferData.descriere}
              onChangeText={v => setLieferData(p => ({ ...p, descriere: v }))}
              multiline placeholder="Opțional..."
            />
            <PhotoPicker photos={lieferData.photos}
              onChange={ph => setLieferData(p => ({ ...p, photos: ph }))}
            />
          </>
        );

      // E — Montaj NVT/PDP/MFG
      case 'montaj_nvt_pdp':
        return (
          <>
            <LocationField label="Locație" mode="single" required
              startValue={montajData.locatie}
              onChangeStart={v => setMontajData(p => ({ ...p, locatie: v }))}
            />
            <PhotoPicker photos={montajData.photos}
              onChange={ph => setMontajData(p => ({ ...p, photos: ph }))}
              minPhotos={4}
              label="Fotografii (minim 4): Soclu, Cutie, Cabluri, Ansamblu+Decor"
            />
          </>
        );

      // F — HP+
      case 'hp_plus':
        return (
          <>
            <LocationField label="Locație (STR. + NR.)" mode="single" required
              startValue={hpData.locatie}
              onChangeStart={v => setHpData(p => ({ ...p, locatie: v }))}
            />
            <PhotoPicker photos={hpData.photos}
              onChange={ph => setHpData(p => ({ ...p, photos: ph }))}
              minPhotos={2}
              label="Fotografii (minim 2): Detaliu Cablu, Locație în Ansamblu"
            />
          </>
        );

      // G — HA
      case 'ha':
        return (
          <>
            <LocationField label="Locație (STR. + NR.)" mode="single" required
              startValue={haData.locatie}
              onChangeStart={v => setHaData(p => ({ ...p, locatie: v }))}
            />
            <Dropdown label="Tip Conectare" value={haData.tip_conectare} required
              options={[
                { value: 'kit_complet', label: 'Kit Complet' },
                { value: 'conectat_strada', label: 'Conectat Stradă' },
              ]}
              onChange={v => setHaData(p => ({ ...p, tip_conectare: v as any }))}
            />
            <Dropdown label="Suprafață" value={haData.suprafata} required
              options={[
                { value: 'asfalt', label: 'Asfalt' },
                { value: 'pavaj', label: 'Pavaj' },
                { value: 'beton', label: 'Beton' },
                { value: 'fara_strat', label: 'Fără Strat' },
                { value: 'mixt', label: 'Mixt' },
              ]}
              onChange={v => setHaData(p => ({ ...p, suprafata: v as any }))}
            />
            {haData.suprafata === 'mixt' && (
              <TextField label="Detalii Mixt" value={haData.suprafata_mixt_detalii} required
                onChangeText={v => setHaData(p => ({ ...p, suprafata_mixt_detalii: v }))}
                placeholder="ex: 5m asf. / 2m pavaj / 7m total"
              />
            )}
            <PhotoPicker photos={haData.photos}
              onChange={ph => setHaData(p => ({ ...p, photos: ph }))}
              minPhotos={5}
              label="Fotografii (minim 5): Bifurcație, Traseu, Kit, Kit Interior, Capac"
            />
          </>
        );

      // H — Reparație
      case 'reparatie':
        return (
          <>
            <LocationField label="Locație" mode="single" required
              startValue={repData.locatie}
              onChangeStart={v => setRepData(p => ({ ...p, locatie: v }))}
            />
            <TextField label="Detalii Reparație" value={repData.descriere} required
              onChangeText={v => setRepData(p => ({ ...p, descriere: v }))}
              multiline placeholder="Descriere obligatorie..."
            />
            <PhotoPicker photos={repData.photos}
              onChange={ph => setRepData(p => ({ ...p, photos: ph }))}
            />
          </>
        );

      // I — Tras Țeavă
      case 'tras_teava':
        return (
          <>
            <LocationField label="Locație" mode="route" required
              startValue={trasData.start} stopValue={trasData.stop}
              onChangeStart={v => setTrasData(p => ({ ...p, start: v }))}
              onChangeStop={v => setTrasData(p => ({ ...p, stop: v }))}
            />
            <TextField label="Nr. de Cabluri" value={trasData.nr_cabluri} required
              onChangeText={v => setTrasData(p => ({ ...p, nr_cabluri: v }))}
              keyboardType="numeric"
            />
            <TextField label="Lungime (m)" value={trasData.lungime} required
              onChangeText={v => setTrasData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <PhotoPicker photos={trasData.photos}
              onChange={ph => setTrasData(p => ({ ...p, photos: ph }))}
            />
          </>
        );

      // J — Groapă
      case 'groapa':
        return (
          <>
            <LocationField label="Locație (Stradă + Nr.)" mode="single" required
              startValue={groapaData.locatie}
              onChangeStart={v => setGroapaData(p => ({ ...p, locatie: v }))}
            />
            <Dropdown label="Terasament" value={groapaData.terasament} required
              options={[
                { value: 'asfalt', label: 'Asfalt' },
                { value: 'pavaj', label: 'Pavaj' },
                { value: 'alta', label: 'Altă suprafață' },
              ]}
              onChange={v => setGroapaData(p => ({ ...p, terasament: v as any }))}
            />
            {groapaData.terasament === 'asfalt' && (
              <TextField label="Grosime Asfalt (cm)" value={groapaData.grosime_asfalt} required
                onChangeText={v => setGroapaData(p => ({ ...p, grosime_asfalt: v }))}
                keyboardType="decimal-pad"
              />
            )}
            <TextField label="Lungime (m)" value={groapaData.lungime}
              onChangeText={v => setGroapaData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label="Lățime (m)" value={groapaData.latime}
              onChangeText={v => setGroapaData(p => ({ ...p, latime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label="Adâncime (m)" value={groapaData.adancime}
              onChangeText={v => setGroapaData(p => ({ ...p, adancime: v }))}
              keyboardType="decimal-pad"
            />
            <PhotoPicker photos={groapaData.photos}
              onChange={ph => setGroapaData(p => ({ ...p, photos: ph }))}
              minPhotos={groapaData.terasament === 'asfalt' ? 3 : 3}
              label={groapaData.terasament === 'asfalt' ? 'Fotografii (minim 3 incl. grosime asfalt)' : 'Fotografii (minim 3)'}
            />
          </>
        );

      // K — Traversare
      case 'traversare':
        return (
          <>
            <LocationField label="Locație" mode="route" required
              startValue={traversareData.start} stopValue={traversareData.stop}
              onChangeStart={v => setTraversareData(p => ({ ...p, start: v }))}
              onChangeStop={v => setTraversareData(p => ({ ...p, stop: v }))}
            />
            <TextField label="Lungime (m)" value={traversareData.lungime}
              onChangeText={v => setTraversareData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label="Lățime (m)" value={traversareData.latime}
              onChangeText={v => setTraversareData(p => ({ ...p, latime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label="Adâncime (m)" value={traversareData.adancime}
              onChangeText={v => setTraversareData(p => ({ ...p, adancime: v }))}
              keyboardType="decimal-pad"
            />
            <Dropdown label="Terasament" value={traversareData.terasament}
              options={[
                { value: 'asfalt', label: 'Asfalt' },
                { value: 'alta', label: 'Altă suprafață' },
              ]}
              onChange={v => setTraversareData(p => ({ ...p, terasament: v as any }))}
            />
            {traversareData.terasament === 'asfalt' && (
              <TextField label="Grosime Asfalt (cm)" value={traversareData.grosime_asfalt}
                onChangeText={v => setTraversareData(p => ({ ...p, grosime_asfalt: v }))}
                keyboardType="decimal-pad"
              />
            )}
            <TextField label="Nr. Cabluri Montate" value={traversareData.nr_cabluri} required
              onChangeText={v => setTraversareData(p => ({ ...p, nr_cabluri: v }))}
              keyboardType="numeric"
            />
            <Dropdown label="Țeavă Protecție" value={traversareData.teava_protectie}
              options={[{ value: 'da', label: 'DA' }, { value: 'nu', label: 'NU' }]}
              onChange={v => setTraversareData(p => ({ ...p, teava_protectie: v as any }))}
            />
            <PhotoPicker photos={traversareData.photos}
              onChange={ph => setTraversareData(p => ({ ...p, photos: ph }))}
              minPhotos={4}
              label={traversareData.terasament === 'asfalt' ? 'Fotografii (minim 4 incl. grosime)' : 'Fotografii (minim 4)'}
            />
          </>
        );

      // L — Săpătură
      case 'sapatura':
        return (
          <>
            <LocationField label="Locație" mode="route" required
              startValue={sapaturaData.start} stopValue={sapaturaData.stop}
              onChangeStart={v => setSapaturaData(p => ({ ...p, start: v }))}
              onChangeStop={v => setSapaturaData(p => ({ ...p, stop: v }))}
            />
            <Dropdown label="Tip" value={sapaturaData.tip} required
              options={[
                { value: 'strada', label: 'Stradă' },
                { value: 'trotuar', label: 'Trotuar' },
                { value: 'privat', label: 'Privat' },
              ]}
              onChange={v => setSapaturaData(p => ({ ...p, tip: v as any }))}
            />
            <Dropdown label="Terasament" value={sapaturaData.terasament}
              options={[
                { value: 'asfalt', label: 'Asfalt' },
                { value: 'alta', label: 'Altă suprafață' },
              ]}
              onChange={v => setSapaturaData(p => ({ ...p, terasament: v as any }))}
            />
            {sapaturaData.terasament === 'asfalt' && (
              <TextField label="Grosime Asfalt (cm)" value={sapaturaData.grosime_asfalt}
                onChangeText={v => setSapaturaData(p => ({ ...p, grosime_asfalt: v }))}
                keyboardType="decimal-pad"
              />
            )}
            <TextField label="Lungime (m)" value={sapaturaData.lungime}
              onChangeText={v => setSapaturaData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label="Lățime (m)" value={sapaturaData.latime}
              onChangeText={v => setSapaturaData(p => ({ ...p, latime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label="Adâncime (m)" value={sapaturaData.adancime}
              onChangeText={v => setSapaturaData(p => ({ ...p, adancime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label="Nr. Cabluri Montate" value={sapaturaData.nr_cabluri} required
              onChangeText={v => setSapaturaData(p => ({ ...p, nr_cabluri: v }))}
              keyboardType="numeric"
            />
            <PhotoPicker photos={sapaturaData.photos}
              onChange={ph => setSapaturaData(p => ({ ...p, photos: ph }))}
              label={sapaturaData.terasament === 'asfalt'
                ? 'Fotografii (minim 3 incl. grosime; minim 2/10m)'
                : 'Fotografii (minim 2 la fiecare 10m)'}
            />
          </>
        );

      // M — Raport Zilnic
      case 'raport_zilnic':
        return (
          <>
            <View style={styles.mandatoryBanner}>
              <Text style={styles.mandatoryText}>RAPORT ZILNIC — OBLIGATORIU</Text>
            </View>
            <TextField label="Lungime Totală Executată (m)" value={raportData.lungime_totala} required
              onChangeText={v => setRaportData(p => ({ ...p, lungime_totala: v }))}
              keyboardType="decimal-pad"
              hint="Public + Privat"
            />
            <TextField label="Nr. Branșamente HA" value={raportData.nr_bransamente_ha}
              onChangeText={v => setRaportData(p => ({ ...p, nr_bransamente_ha: v }))}
              keyboardType="numeric"
            />
            <TextField label="Nr. HP+" value={raportData.nr_hp_plus}
              onChangeText={v => setRaportData(p => ({ ...p, nr_hp_plus: v }))}
              keyboardType="numeric"
            />
            <LocationField label="Locație Start → Stop" mode="route" required
              startValue={raportData.locatie_start} stopValue={raportData.locatie_stop}
              onChangeStart={v => setRaportData(p => ({ ...p, locatie_start: v }))}
              onChangeStop={v => setRaportData(p => ({ ...p, locatie_stop: v }))}
            />
            <PhotoPicker photos={raportData.photos}
              onChange={ph => setRaportData(p => ({ ...p, photos: ph }))}
              minPhotos={5}
              label="Fotografii (minim 5): Traseu, Detalii, Grosime Deckschicht"
            />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Înapoi</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{WORK_TYPE_LABELS[workType]}</Text>
          <Text style={styles.headerSub}>{siteName}{nvtNumber ? ` — ${nvtNumber}` : ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {renderForm()}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Salvează Raport</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  backText: { color: '#F97316', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '700' },
  headerSub: { color: '#64748B', fontSize: 11, marginTop: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  mandatoryBanner: {
    backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderLeftWidth: 3, borderLeftColor: '#F97316',
    marginBottom: 16,
  },
  mandatoryText: { color: '#F97316', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  saveBtn: {
    backgroundColor: '#F97316', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
