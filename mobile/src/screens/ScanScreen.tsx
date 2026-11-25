import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api, thumbUrl } from '../api';
import { T } from '../theme';

/**
 * ESCANEAR CARTA: foto con la cámara (o galería) → el backend la identifica
 * con Claude (visión) → match en la base (o import desde la web) → agregar
 * a la colección con un toque.
 */
export default function ScanScreen() {
  const camRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [added, setAdded] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const process = async (uri: string) => {
    setBusy('Identificando carta…'); setError(''); setResult(null); setAdded({});
    try {
      // Reducir la foto (~900px) para que el payload sea liviano.
      const small = await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 900 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const r = await api.scan(small.base64!);
      setResult(r);
      if (!r.matches?.length && !r.webMatches?.length) {
        setError(r.message ?? 'No se encontró la carta.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error al escanear');
    } finally { setBusy(null); }
  };

  const shoot = async () => {
    const photo = await camRef.current?.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) await process(photo.uri);
  };

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]?.uri) await process(r.assets[0].uri);
  };

  const addLocal = async (card: any) => {
    setBusy('Agregando…');
    try {
      const variant = card.variants?.[0] ?? 'Normal';
      const r = await api.adjust(card.id, variant, 'EN', 1);
      setAdded((a) => ({ ...a, [card.id]: r.quantity }));
    } catch (e: any) { setError(e?.message ?? 'No se pudo agregar'); }
    finally { setBusy(null); }
  };

  const importAndAdd = async (web: any) => {
    setBusy('Importando desde la web…');
    try {
      const card = await api.importWeb(web.apiId);
      await addLocal(card);
      setResult((r: any) => ({ ...r, matches: [card], webMatches: [] }));
    } catch (e: any) { setError(e?.message ?? 'No se pudo importar'); setBusy(null); }
  };

  if (!permission) return <View style={s.wrap} />;
  if (!permission.granted) {
    return (
      <View style={[s.wrap, s.center]}>
        <Text style={s.permTxt}>Necesitamos la cámara para escanear tus cartas.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnTxt}>Permitir cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={pick}>
          <Text style={s.btnGhostTxt}>Elegir foto de la galería</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.camBox}>
        <CameraView ref={camRef} style={s.cam} facing="back" />
        <View style={s.frame} pointerEvents="none" />
      </View>
      <Text style={s.hintTxt}>Encuadra la carta completa, con buena luz.</Text>

      <View style={s.actions}>
        <TouchableOpacity style={[s.btn, s.btnGhost, { flex: 1 }]} onPress={pick} disabled={!!busy}>
          <Text style={s.btnGhostTxt}>Galería</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.shutter]} onPress={shoot} disabled={!!busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <View style={s.shutterInner} />}
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      {busy ? <Text style={s.busyTxt}>{busy}</Text> : null}
      {error ? <Text style={s.errTxt}>{error}</Text> : null}

      {result && (result.matches?.length > 0 || result.webMatches?.length > 0) && (
        <ScrollView style={s.results}>
          {result.reading?.name ? (
            <Text style={s.readTxt}>
              Leído: <Text style={{ color: T.text, fontWeight: '700' }}>{result.reading.name}</Text>
              {result.reading.number ? ` · ${result.reading.number}${result.reading.total ? '/' + result.reading.total : ''}` : ''}
            </Text>
          ) : null}
          {result.matches?.map((c: any) => (
            <View key={c.id} style={s.hit}>
              {c.imageUrl ? <Image source={{ uri: thumbUrl(c.imageUrl) }} style={s.hitImg} resizeMode="contain" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={s.hitName}>{c.name}</Text>
                <Text style={s.hitSub}>{c.set?.name} · {c.number}</Text>
              </View>
              {added[c.id] ? (
                <Text style={s.addedTxt}>✓ tienes {added[c.id]}</Text>
              ) : (
                <TouchableOpacity style={s.addBtn} onPress={() => addLocal(c)} disabled={!!busy}>
                  <Text style={s.addBtnTxt}>+ Agregar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {result.webMatches?.map((w: any) => (
            <View key={w.apiId} style={s.hit}>
              {w.imageUrl ? <Image source={{ uri: w.imageUrl }} style={s.hitImg} resizeMode="contain" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={s.hitName}>{w.name}</Text>
                <Text style={s.hitSub}>{w.setName} · {w.number}{w.printedTotal ? '/' + w.printedTotal : ''} · web</Text>
              </View>
              {w.setInDb ? (
                <TouchableOpacity style={s.addBtn} onPress={() => importAndAdd(w)} disabled={!!busy}>
                  <Text style={s.addBtnTxt}>Importar +</Text>
                </TouchableOpacity>
              ) : <Text style={s.hitSub}>set no importado</Text>}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg, padding: 14 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 14 },
  permTxt: { color: T.text, fontSize: 15, textAlign: 'center', marginBottom: 6 },
  camBox: { borderRadius: 14, overflow: 'hidden', aspectRatio: 3 / 4, backgroundColor: T.card },
  cam: { flex: 1 },
  frame: {
    position: 'absolute', top: '8%', bottom: '8%', left: '16%', right: '16%',
    borderColor: 'rgba(52,211,153,0.9)', borderWidth: 2, borderRadius: 12,
  },
  hintTxt: { color: T.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  shutter: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: T.accentDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 48, height: 48, borderRadius: 24, borderColor: '#fff', borderWidth: 3 },
  btn: { backgroundColor: T.primaryDeep, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: T.card, borderColor: T.border, borderWidth: 1 },
  btnGhostTxt: { color: T.text, fontWeight: '600', fontSize: 13 },
  busyTxt: { color: T.accent, textAlign: 'center', marginTop: 10, fontSize: 13 },
  errTxt: { color: T.danger, textAlign: 'center', marginTop: 10, fontSize: 13 },
  results: { marginTop: 12 },
  readTxt: { color: T.muted, fontSize: 12, marginBottom: 8 },
  hit: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8,
  },
  hitImg: { width: 44, height: 62, borderRadius: 4 },
  hitName: { color: T.text, fontWeight: '700', fontSize: 14 },
  hitSub: { color: T.muted, fontSize: 11, marginTop: 2 },
  addBtn: { backgroundColor: T.accentDeep, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  addedTxt: { color: T.accent, fontWeight: '800', fontSize: 12 },
});
