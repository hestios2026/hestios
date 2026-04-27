import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TextField, Dropdown, LocationField, hasPin } from '../components/FormField';
import PhotoPicker from '../components/PhotoPicker';
import { enqueue } from '../store/offlineQueue';
import { newUUID } from '../utils/timestamp';
import { T } from '../theme';
import { useLang } from '../i18n';
import type {
  WorkType, AuthUser, PhotoEntry,
  DataPozeInainte, DataTeratest, DataSemneCirculatie, DataLieferScheine,
  DataMontajNvtPdp, DataHpPlus, DataHA, DataReparatie, DataTrasTeava,
  DataGroapa, DataTraversare, DataSapatura, DataRaportZilnic,
  DataComandaMateriale,
} from '../types';

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
  const { tr } = useLang();
  const [saving, setSaving] = useState(false);

  // ─── Per-type state ───────────────────────────────────────────────────────

  // A — Poze Înainte
  const [pozeData, setPozeData] = useState<DataPozeInainte>({
    tip: '', start: '', stop: '', waypoints: [], photos: [],
  });

  // B — Teratest
  const [teraData, setTeraData] = useState<DataTeratest>({
    moment: '', photos: [],
  });

  // C — Semne Circulatie
  const [semneData, setSemneData] = useState<DataSemneCirculatie>({
    start: '', stop: '', waypoints: [], photos: [],
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
    locatie: '', tip_conectare: '', suprafata: '', suprafata_mixt_detalii: '', lungime: '', photos: [],
  });

  // H — Reparatie
  const [repData, setRepData] = useState<DataReparatie>({
    locatie: '', descriere: '', photos: [],
  });

  // I — Tras Teava
  const [trasData, setTrasData] = useState<DataTrasTeava>({
    start: '', stop: '', waypoints: [], nr_cabluri: '', lungime: '', photos: [],
  });

  // J — Groapa
  const [groapaData, setGroapaData] = useState<DataGroapa>({
    locatie: '', terasament: '', grosime_asfalt: '', lungime: '', latime: '', adancime: '', photos: [],
  });

  // K — Traversare
  const [traversareData, setTraversareData] = useState<DataTraversare>({
    start: '', stop: '', waypoints: [], lungime: '', latime: '', adancime: '', terasament: '',
    grosime_asfalt: '', nr_cabluri: '', teava_protectie: '', photos: [],
  });

  // L — Sapatura
  const [sapaturaData, setSapaturaData] = useState<DataSapatura>({
    start: '', stop: '', waypoints: [], terasament: '', grosime_asfalt: '', lungime: '',
    latime: '', adancime: '', tip: '', nr_cabluri: '', comentarii: '', photos: [],
  });

  // M — Raport Zilnic
  const [raportData, setRaportData] = useState<DataRaportZilnic>({
    lungime_totala: '', nr_bransamente_ha: '', nr_hp_plus: '',
    locatie_start: '', locatie_stop: '', waypoints: [], photos: [],
  });

  // N — Comandă Materiale
  const [comandaData, setComandaData] = useState<DataComandaMateriale>({
    materiale: '', urgenta: '', notes: '',
  });

  // ─── Validation ────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    switch (workType) {
      case 'poze_inainte':
        if (!pozeData.tip) return tr.vSelectTip;
        if (!hasPin(pozeData.start)) return tr.vPinRequired;
        if (!hasPin(pozeData.stop)) return tr.vPinStopRequired;
        if (pozeData.photos.length < 2) return tr.vMinPhotos(2);
        break;
      case 'teratest':
        if (!teraData.moment) return tr.vSelectMoment;
        if (teraData.photos.length < 2) return tr.vMinPhotos(2);
        break;
      case 'semne_circulatie':
        if (!hasPin(semneData.start)) return tr.vPinRequired;
        if (!hasPin(semneData.stop)) return tr.vPinStopRequired;
        if (semneData.photos.length < 6) return tr.vMinPhotos(6);
        break;
      case 'liefer_scheine':
        if (!lieferData.descriere) return tr.vEnterDescription;
        if (lieferData.photos.length === 0) return tr.vAddPhoto;
        break;
      case 'montaj_nvt_pdp':
        if (!hasPin(montajData.locatie)) return tr.vPinRequired;
        if (montajData.photos.length < 4) return tr.vMinPhotos(4);
        break;
      case 'hp_plus':
        if (!hasPin(hpData.locatie)) return tr.vPinRequired;
        if (hpData.photos.length < 2) return tr.vMinPhotos(2);
        break;
      case 'ha':
        if (!hasPin(haData.locatie)) return tr.vPinRequired;
        if (!haData.tip_conectare) return tr.vSelectConnectionType;
        if (!haData.suprafata) return tr.vSelectSurface;
        if (haData.suprafata === 'mixt' && !haData.suprafata_mixt_detalii) return tr.vEnterDescription;
        if (haData.photos.length < 5) return tr.vMinPhotos(5);
        break;
      case 'reparatie':
        if (!hasPin(repData.locatie)) return tr.vPinRequired;
        if (!repData.descriere) return tr.vEnterDescription;
        if (repData.photos.length < 2) return tr.vMinPhotos(2);
        break;
      case 'tras_teava':
        if (!hasPin(trasData.start)) return tr.vPinRequired;
        if (!hasPin(trasData.stop)) return tr.vPinStopRequired;
        if (!trasData.nr_cabluri) return tr.vEnterCables;
        if (!trasData.lungime) return tr.vEnterLength;
        if (trasData.photos.length < 2) return tr.vMinPhotos(2);
        break;
      case 'groapa':
        if (!hasPin(groapaData.locatie)) return tr.vPinRequired;
        if (!groapaData.terasament) return tr.vSelectTerrain;
        if (groapaData.terasament === 'asfalt' && !groapaData.grosime_asfalt)
          return tr.vEnterAsphalt;
        if (!groapaData.lungime) return tr.vEnterLength;
        if (!groapaData.latime) return tr.vEnterWidth;
        if (!groapaData.adancime) return tr.vEnterDepth;
        if (groapaData.photos.length < 3) return tr.vMinPhotos(3);
        break;
      case 'traversare':
        if (!hasPin(traversareData.start)) return tr.vPinRequired;
        if (!hasPin(traversareData.stop)) return tr.vPinStopRequired;
        if (!traversareData.lungime) return tr.vEnterLength;
        if (!traversareData.latime) return tr.vEnterWidth;
        if (!traversareData.adancime) return tr.vEnterDepth;
        if (!traversareData.nr_cabluri) return tr.vEnterCablesMounted;
        if (traversareData.photos.length < 4) return tr.vMinPhotos(4);
        break;
      case 'sapatura':
        if (!hasPin(sapaturaData.start)) return tr.vPinRequired;
        if (!hasPin(sapaturaData.stop)) return tr.vPinStopRequired;
        if (!sapaturaData.tip) return tr.vSelectSapaturaTip;
        if (!sapaturaData.terasament) return tr.vSelectTerrain;
        if (sapaturaData.terasament === 'asfalt' && !sapaturaData.grosime_asfalt)
          return tr.vEnterAsphalt;
        if (!sapaturaData.lungime) return tr.vEnterLength;
        if (!sapaturaData.latime) return tr.vEnterWidth;
        if (!sapaturaData.adancime) return tr.vEnterDepth;
        if (!sapaturaData.nr_cabluri) return tr.vEnterCablesMounted;
        if (sapaturaData.photos.length < 3) return tr.vMinPhotos(3);
        break;
      case 'raport_zilnic':
        if (!raportData.lungime_totala) return tr.vEnterTotalLength;
        if (!raportData.nr_bransamente_ha) return tr.vEnterHaCount;
        if (!raportData.nr_hp_plus) return tr.vEnterHpCount;
        if (!hasPin(raportData.locatie_start)) return tr.vPinRequired;
        if (!hasPin(raportData.locatie_stop)) return tr.vPinStopRequired;
        if (raportData.photos.length < 5) return tr.vMinPhotos(5);
        break;
      case 'comanda_materiale':
        if (!comandaData.materiale.trim()) return tr.vEnterMateriale;
        if (!comandaData.urgenta) return tr.vSelectUrgenta;
        break;
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) { Alert.alert(tr.incompleteFields, error); return; }

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
        comanda_materiale: comandaData,
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

      Alert.alert(tr.savedTitle, tr.savedMsg, [
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
            <Dropdown label={tr.fTip} value={pozeData.tip} required
              options={[{ value: 'public', label: tr.optPublic }, { value: 'privat', label: tr.optPrivat }]}
              onChange={v => setPozeData(p => ({ ...p, tip: v as any }))}
            />
            <LocationField label={tr.fLocation} mode="route" required
              startValue={pozeData.start} stopValue={pozeData.stop}
              waypointValues={pozeData.waypoints}
              onChangeStart={v => setPozeData(p => ({ ...p, start: v }))}
              onChangeStop={v => setPozeData(p => ({ ...p, stop: v }))}
              onChangeWaypoints={v => setPozeData(p => ({ ...p, waypoints: v }))}
            />
            <PhotoPicker photos={pozeData.photos}
              onChange={ph => setPozeData(p => ({ ...p, photos: ph }))}
              minPhotos={2}
            />
          </>
        );

      // B — Teratest
      case 'teratest':
        return (
          <>
            <Dropdown label={tr.fMoment} value={teraData.moment} required
              options={[
                { value: 'inainte_sapatura', label: tr.optBefore },
                { value: 'dupa_umplere', label: tr.optAfter },
              ]}
              onChange={v => setTeraData(p => ({ ...p, moment: v as any }))}
            />
            <PhotoPicker photos={teraData.photos}
              onChange={ph => setTeraData(p => ({ ...p, photos: ph }))}
              minPhotos={2}
              label={tr.photoPickerLabels.teratest}
            />
          </>
        );

      // C — Semne Circulație
      case 'semne_circulatie':
        return (
          <>
            <LocationField label={tr.fLocationRoute} mode="route" required
              startValue={semneData.start} stopValue={semneData.stop}
              waypointValues={semneData.waypoints}
              onChangeStart={v => setSemneData(p => ({ ...p, start: v }))}
              onChangeStop={v => setSemneData(p => ({ ...p, stop: v }))}
              onChangeWaypoints={v => setSemneData(p => ({ ...p, waypoints: v }))}
            />
            <PhotoPicker photos={semneData.photos}
              onChange={ph => setSemneData(p => ({ ...p, photos: ph }))}
              minPhotos={6}
              label={tr.photoPickerLabels.semne}
            />
          </>
        );

      // D — Liefer Scheine
      case 'liefer_scheine':
        return (
          <>
            <TextField label={tr.fDescription} value={lieferData.descriere} required
              onChangeText={v => setLieferData(p => ({ ...p, descriere: v }))}
              multiline placeholder="..."
            />
            <PhotoPicker photos={lieferData.photos}
              onChange={ph => setLieferData(p => ({ ...p, photos: ph }))}
              minPhotos={1}
            />
          </>
        );

      // E — Montaj NVT/PDP/MFG
      case 'montaj_nvt_pdp':
        return (
          <>
            <LocationField label={tr.fLocation} mode="single" required
              startValue={montajData.locatie}
              onChangeStart={v => setMontajData(p => ({ ...p, locatie: v }))}
            />
            <PhotoPicker photos={montajData.photos}
              onChange={ph => setMontajData(p => ({ ...p, photos: ph }))}
              minPhotos={4}
              label={tr.photoPickerLabels.montaj}
            />
          </>
        );

      // F — HP+
      case 'hp_plus':
        return (
          <>
            <LocationField label={tr.fLocationStreetNr} mode="single" required
              startValue={hpData.locatie}
              onChangeStart={v => setHpData(p => ({ ...p, locatie: v }))}
            />
            <PhotoPicker photos={hpData.photos}
              onChange={ph => setHpData(p => ({ ...p, photos: ph }))}
              minPhotos={2}
              label={tr.photoPickerLabels.hp_plus}
            />
          </>
        );

      // G — HA
      case 'ha':
        return (
          <>
            <LocationField label={tr.fLocationStreetNr} mode="single" required
              startValue={haData.locatie}
              onChangeStart={v => setHaData(p => ({ ...p, locatie: v }))}
            />
            <Dropdown label={tr.fConnectionType} value={haData.tip_conectare} required
              options={[
                { value: 'kit_complet', label: tr.optKitComplet },
                { value: 'conectat_strada', label: tr.optConectatStrada },
              ]}
              onChange={v => setHaData(p => ({ ...p, tip_conectare: v as any }))}
            />
            <Dropdown label={tr.fSurface} value={haData.suprafata} required
              options={[
                { value: 'asfalt', label: tr.optAsfalt },
                { value: 'pavaj', label: tr.optPavaj },
                { value: 'beton', label: tr.optBeton },
                { value: 'fara_strat', label: tr.optFaraStrat },
                { value: 'mixt', label: tr.optMixt },
              ]}
              onChange={v => setHaData(p => ({ ...p, suprafata: v as any }))}
            />
            {haData.suprafata === 'mixt' && (
              <TextField label={tr.fMixtDetails} value={haData.suprafata_mixt_detalii} required
                onChangeText={v => setHaData(p => ({ ...p, suprafata_mixt_detalii: v }))}
                placeholder="ex: 5m asf. / 2m pavaj / 7m total"
              />
            )}
            <TextField label="Metri efectuați" value={haData.lungime}
              onChangeText={v => setHaData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad" placeholder="ex: 12.5"
            />
            <PhotoPicker photos={haData.photos}
              onChange={ph => setHaData(p => ({ ...p, photos: ph }))}
              minPhotos={5}
              label={tr.photoPickerLabels.ha}
            />
          </>
        );

      // H — Reparație
      case 'reparatie':
        return (
          <>
            <LocationField label={tr.fLocation} mode="single" required
              startValue={repData.locatie}
              onChangeStart={v => setRepData(p => ({ ...p, locatie: v }))}
            />
            <TextField label={tr.fRepairDetails} value={repData.descriere} required
              onChangeText={v => setRepData(p => ({ ...p, descriere: v }))}
              multiline placeholder="..."
            />
            <PhotoPicker photos={repData.photos}
              onChange={ph => setRepData(p => ({ ...p, photos: ph }))}
              minPhotos={2}
            />
          </>
        );

      // I — Tras Țeavă
      case 'tras_teava':
        return (
          <>
            <LocationField label={tr.fLocation} mode="route" required
              startValue={trasData.start} stopValue={trasData.stop}
              waypointValues={trasData.waypoints}
              onChangeStart={v => setTrasData(p => ({ ...p, start: v }))}
              onChangeStop={v => setTrasData(p => ({ ...p, stop: v }))}
              onChangeWaypoints={v => setTrasData(p => ({ ...p, waypoints: v }))}
            />
            <TextField label={tr.fCables} value={trasData.nr_cabluri} required
              onChangeText={v => setTrasData(p => ({ ...p, nr_cabluri: v }))}
              keyboardType="numeric"
            />
            <TextField label={tr.fLength} value={trasData.lungime} required
              onChangeText={v => setTrasData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <PhotoPicker photos={trasData.photos}
              onChange={ph => setTrasData(p => ({ ...p, photos: ph }))}
              minPhotos={2}
            />
          </>
        );

      // J — Groapă
      case 'groapa':
        return (
          <>
            <LocationField label={tr.fLocationStreet} mode="single" required
              startValue={groapaData.locatie}
              onChangeStart={v => setGroapaData(p => ({ ...p, locatie: v }))}
            />
            <Dropdown label={tr.fTerrain} value={groapaData.terasament} required
              options={[
                { value: 'asfalt', label: tr.optAsfalt },
                { value: 'pavaj', label: tr.optPavaj },
                { value: 'alta', label: tr.optAltaSup },
              ]}
              onChange={v => setGroapaData(p => ({ ...p, terasament: v as any }))}
            />
            {groapaData.terasament === 'asfalt' && (
              <TextField label={tr.fAsphaltThickness} value={groapaData.grosime_asfalt} required
                onChangeText={v => setGroapaData(p => ({ ...p, grosime_asfalt: v }))}
                keyboardType="decimal-pad"
              />
            )}
            <TextField label={tr.fLength} value={groapaData.lungime} required
              onChangeText={v => setGroapaData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label={tr.fWidth} value={groapaData.latime} required
              onChangeText={v => setGroapaData(p => ({ ...p, latime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label={tr.fDepth} value={groapaData.adancime} required
              onChangeText={v => setGroapaData(p => ({ ...p, adancime: v }))}
              keyboardType="decimal-pad"
            />
            <PhotoPicker photos={groapaData.photos}
              onChange={ph => setGroapaData(p => ({ ...p, photos: ph }))}
              minPhotos={3}
              label={groapaData.terasament === 'asfalt' ? tr.photoPickerLabels.groapaAsfalt : tr.photoPickerLabels.groapa}
            />
          </>
        );

      // K — Traversare
      case 'traversare':
        return (
          <>
            <LocationField label={tr.fLocation} mode="route" required
              startValue={traversareData.start} stopValue={traversareData.stop}
              waypointValues={traversareData.waypoints}
              onChangeStart={v => setTraversareData(p => ({ ...p, start: v }))}
              onChangeStop={v => setTraversareData(p => ({ ...p, stop: v }))}
              onChangeWaypoints={v => setTraversareData(p => ({ ...p, waypoints: v }))}
            />
            <TextField label={tr.fLength} value={traversareData.lungime} required
              onChangeText={v => setTraversareData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label={tr.fWidth} value={traversareData.latime} required
              onChangeText={v => setTraversareData(p => ({ ...p, latime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label={tr.fDepth} value={traversareData.adancime} required
              onChangeText={v => setTraversareData(p => ({ ...p, adancime: v }))}
              keyboardType="decimal-pad"
            />
            <Dropdown label={tr.fTerrain} value={traversareData.terasament} required
              options={[
                { value: 'asfalt', label: tr.optAsfalt },
                { value: 'alta', label: tr.optAltaSup },
              ]}
              onChange={v => setTraversareData(p => ({ ...p, terasament: v as any }))}
            />
            {traversareData.terasament === 'asfalt' && (
              <TextField label={tr.fAsphaltThickness} value={traversareData.grosime_asfalt} required
                onChangeText={v => setTraversareData(p => ({ ...p, grosime_asfalt: v }))}
                keyboardType="decimal-pad"
              />
            )}
            <TextField label={tr.fCablesMounted} value={traversareData.nr_cabluri} required
              onChangeText={v => setTraversareData(p => ({ ...p, nr_cabluri: v }))}
              keyboardType="numeric"
            />
            <Dropdown label={tr.fProtPipe} value={traversareData.teava_protectie} required
              options={[{ value: 'da', label: tr.optDa }, { value: 'nu', label: tr.optNu }]}
              onChange={v => setTraversareData(p => ({ ...p, teava_protectie: v as any }))}
            />
            <PhotoPicker photos={traversareData.photos}
              onChange={ph => setTraversareData(p => ({ ...p, photos: ph }))}
              minPhotos={4}
              label={traversareData.terasament === 'asfalt' ? tr.photoPickerLabels.traversareAsfalt : tr.photoPickerLabels.traversare}
            />
          </>
        );

      // L — Săpătură
      case 'sapatura':
        return (
          <>
            <LocationField label={tr.fLocation} mode="route" required
              startValue={sapaturaData.start} stopValue={sapaturaData.stop}
              waypointValues={sapaturaData.waypoints}
              onChangeStart={v => setSapaturaData(p => ({ ...p, start: v }))}
              onChangeStop={v => setSapaturaData(p => ({ ...p, stop: v }))}
              onChangeWaypoints={v => setSapaturaData(p => ({ ...p, waypoints: v }))}
            />
            <Dropdown label={tr.fTip} value={sapaturaData.tip} required
              options={[
                { value: 'strada', label: tr.optStrada },
                { value: 'trotuar', label: tr.optTrotuar },
                { value: 'privat', label: tr.optPrivat },
              ]}
              onChange={v => setSapaturaData(p => ({ ...p, tip: v as any }))}
            />
            <Dropdown label={tr.fTerrain} value={sapaturaData.terasament} required
              options={[
                { value: 'asfalt', label: tr.optAsfalt },
                { value: 'alta', label: tr.optAltaSup },
              ]}
              onChange={v => setSapaturaData(p => ({ ...p, terasament: v as any }))}
            />
            {sapaturaData.terasament === 'asfalt' && (
              <TextField label={tr.fAsphaltThickness} value={sapaturaData.grosime_asfalt} required
                onChangeText={v => setSapaturaData(p => ({ ...p, grosime_asfalt: v }))}
                keyboardType="decimal-pad"
              />
            )}
            <TextField label={tr.fLength} value={sapaturaData.lungime} required
              onChangeText={v => setSapaturaData(p => ({ ...p, lungime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label={tr.fWidth} value={sapaturaData.latime} required
              onChangeText={v => setSapaturaData(p => ({ ...p, latime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label={tr.fDepth} value={sapaturaData.adancime} required
              onChangeText={v => setSapaturaData(p => ({ ...p, adancime: v }))}
              keyboardType="decimal-pad"
            />
            <TextField label={tr.fCablesMounted} value={sapaturaData.nr_cabluri} required
              onChangeText={v => setSapaturaData(p => ({ ...p, nr_cabluri: v }))}
              keyboardType="numeric"
            />
            <TextField label={tr.fComentarii} value={sapaturaData.comentarii}
              onChangeText={v => setSapaturaData(p => ({ ...p, comentarii: v }))}
              numberOfLines={3}
            />
            <PhotoPicker photos={sapaturaData.photos}
              onChange={ph => setSapaturaData(p => ({ ...p, photos: ph }))}
              minPhotos={3}
              label={sapaturaData.terasament === 'asfalt' ? tr.photoPickerLabels.sapaturaAsfalt : tr.photoPickerLabels.sapatura}
            />
          </>
        );

      // M — Raport Zilnic
      case 'raport_zilnic':
        return (
          <>
            <View style={styles.mandatoryBanner}>
              <Text style={styles.mandatoryText}>{tr.dailyMandatoryBanner}</Text>
            </View>
            <TextField label={tr.fTotalLength} value={raportData.lungime_totala} required
              onChangeText={v => setRaportData(p => ({ ...p, lungime_totala: v }))}
              keyboardType="decimal-pad"
              hint={tr.hPublicPrivat}
            />
            <TextField label={tr.fHaCount} value={raportData.nr_bransamente_ha} required
              onChangeText={v => setRaportData(p => ({ ...p, nr_bransamente_ha: v }))}
              keyboardType="numeric"
            />
            <TextField label={tr.fHpCount} value={raportData.nr_hp_plus} required
              onChangeText={v => setRaportData(p => ({ ...p, nr_hp_plus: v }))}
              keyboardType="numeric"
            />
            <LocationField label={tr.fLocationStartStop} mode="route" required
              startValue={raportData.locatie_start} stopValue={raportData.locatie_stop}
              waypointValues={raportData.waypoints}
              onChangeStart={v => setRaportData(p => ({ ...p, locatie_start: v }))}
              onChangeStop={v => setRaportData(p => ({ ...p, locatie_stop: v }))}
              onChangeWaypoints={v => setRaportData(p => ({ ...p, waypoints: v }))}
            />
            <PhotoPicker photos={raportData.photos}
              onChange={ph => setRaportData(p => ({ ...p, photos: ph }))}
              minPhotos={5}
              label={tr.photoPickerLabels.raportZilnic}
            />
          </>
        );

      // N — Comandă Materiale
      case 'comanda_materiale':
        return (
          <>
            <View style={styles.comandaBanner}>
              <Text style={styles.comandaIcon}>🛒</Text>
              <Text style={styles.comandaBannerText}>Completează ce materiale sunt necesare pe șantier</Text>
            </View>
            <TextField
              label={tr.fMateriale}
              value={comandaData.materiale}
              required
              onChangeText={v => setComandaData(p => ({ ...p, materiale: v }))}
              multiline
              numberOfLines={6}
              placeholder="ex: 50m țeavă HDPE 40mm, 10 buc. mufe, 2 role bandă de avertizare..."
            />
            <Dropdown
              label={tr.fUrgenta}
              value={comandaData.urgenta}
              required
              options={[
                { value: 'normal', label: tr.optNormal },
                { value: 'urgent', label: tr.optUrgent },
              ]}
              onChange={v => setComandaData(p => ({ ...p, urgenta: v as any }))}
            />
            <TextField
              label={tr.fNotesOptional}
              value={comandaData.notes}
              onChangeText={v => setComandaData(p => ({ ...p, notes: v }))}
              multiline
              numberOfLines={3}
              placeholder="Orice detalii suplimentare..."
            />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{tr.workTypeLabels[workType]}</Text>
          <Text style={styles.headerSub}>{siteName}{nvtNumber ? ` · ${nvtNumber}` : ''}</Text>
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
            : <Text style={styles.saveBtnText}>{tr.saveReport}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.dark },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.darkCard, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: T.borderDk,
  },
  backBtn:  { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: T.borderDk, alignItems: 'center', justifyContent: 'center' },
  backArrow:{ color: T.text2, fontSize: 16 },
  headerTitle: { color: T.textLight, fontSize: 15, fontWeight: '800' },
  headerSub:   { color: T.text3, fontSize: 11, marginTop: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  mandatoryBanner: {
    backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    borderLeftWidth: 3, borderLeftColor: T.green,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  mandatoryText: { color: T.green, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  comandaBanner: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  comandaIcon: { fontSize: 22 },
  comandaBannerText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 18 },
  saveBtn: {
    backgroundColor: T.green, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
    elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
