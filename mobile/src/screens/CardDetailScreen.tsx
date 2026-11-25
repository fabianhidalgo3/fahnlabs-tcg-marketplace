import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, thumbUrl } from '../api';
import { T } from '../theme';

export default function CardDetailScreen({ route }: any) {
  const { id } = route.params;
  const [card, setCard] = useState<any>(null);
  const [copies, setCopies] = useState<any>(null);
  const [rate, setRate] = useState(940);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.card(id).then(setCard).catch(() => undefined);
    api.myCopies(id).then(setCopies).catch(() => undefined);
    api.rates().then((r) => setRate(r.usdClp)).catch(() => undefined);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const clp = (usd: number) => '$' + Math.round((usd ?? 0) * rate).toLocaleString('es-CL') + ' CLP';
  const qty = (variant: string, lang: 'EN' | 'ES') =>
    copies?.items?.find((i: any) => i.variant === variant && i.language === lang)?.quantity ?? 0;

  const adj = async (variant: string, lang: 'EN' | 'ES', delta: number) => {
    setBusy(true);
    try { await api.adjust(id, variant, lang, delta); await load(); }
    finally { setBusy(false); }
  };

  if (!card) return <View style={[s.wrap, { justifyContent: 'center' }]}><ActivityIndicator color={T.muted} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {card.imageUrl ? <Image source={{ uri: thumbUrl(card.imageUrl) }} style={s.art} resizeMode="contain" /> : null}
      <Text style={s.title}>{card.name}</Text>
      <Text style={s.sub}>{card.set?.name} · {card.number}{card.rarity ? ` · ${card.rarity}` : ''}</Text>
      {card.attributes?.illustrator ? <Text style={s.artist}>🖌 {card.attributes.illustrator}</Text> : null}

      <Text style={s.sec}>Referencia de precio</Text>
      {(card.variants ?? ['Normal']).map((v: string) => (
        <View key={v} style={s.priceRow}>
          <Text style={[s.vtag, v !== 'Normal' && s.vtagRev]}>{v}</Text>
          <Text style={s.priceClp}>{clp(card.variantValues?.[v] ?? 0)}</Text>
        </View>
      ))}

      <Text style={s.sec}>Mi colección {copies ? `· ${copies.total} copias` : ''}</Text>
      {(card.variants ?? ['Normal']).map((v: string) => (
        <View key={v} style={s.mineRow}>
          <Text style={[s.vtag, v !== 'Normal' && s.vtagRev]}>{v}</Text>
          {(['EN', 'ES'] as const).map((lang) => (
            <View key={lang} style={s.langGroup}>
              <Text style={s.langLbl}>{lang}</Text>
              <TouchableOpacity style={s.stepBtn} disabled={busy || qty(v, lang) === 0} onPress={() => adj(v, lang, -1)}>
                <Text style={s.stepTxt}>−</Text>
              </TouchableOpacity>
              <Text style={[s.qtyTxt, qty(v, lang) === 0 && { color: T.muted }]}>{qty(v, lang)}</Text>
              <TouchableOpacity style={[s.stepBtn, s.stepAdd]} disabled={busy} onPress={() => adj(v, lang, 1)}>
                <Text style={s.stepTxt}>+</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  art: { width: '70%', aspectRatio: 63 / 88, alignSelf: 'center', borderRadius: 12, backgroundColor: T.card },
  title: { color: T.text, fontSize: 22, fontWeight: '800', marginTop: 14 },
  sub: { color: T.muted, fontSize: 13, marginTop: 2 },
  artist: { color: T.muted, fontSize: 12, marginTop: 4 },
  sec: { color: T.text, fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 6,
  },
  vtag: { color: T.muted, fontSize: 11, fontWeight: '700', backgroundColor: T.card2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  vtagRev: { color: '#fff', backgroundColor: '#7c3aed' },
  priceClp: { color: T.accent, fontWeight: '800', fontSize: 15 },
  mineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 6,
  },
  langGroup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  langLbl: { color: T.muted, fontSize: 11, fontWeight: '700' },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: T.card2,
    borderColor: T.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  stepAdd: { backgroundColor: T.primaryDeep, borderColor: T.primaryDeep },
  stepTxt: { color: T.text, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  qtyTxt: { color: T.text, fontWeight: '800', minWidth: 16, textAlign: 'center' },
});
