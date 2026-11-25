import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, thumbUrl } from '../api';
import { T } from '../theme';

/** Marketplace: SOLO cartas repetidas publicadas con stock. */
export default function SinglesScreen({ navigation }: any) {
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [rate, setRate] = useState(940);

  const load = useCallback(() => {
    api.cards({ q, inStock: true, forSale: true, limit: 60 }).then((r) => {
      setData(r.data); setTotal(r.total);
    }).catch(() => undefined);
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api.rates().then((r) => setRate(r.usdClp)).catch(() => undefined); }, []);

  const clp = (usd: number) => '$' + Math.round(usd * rate).toLocaleString('es-CL');

  return (
    <View style={s.wrap}>
      <TextInput
        style={s.search} placeholder="Buscar: nombre, número o artista…" placeholderTextColor={T.muted}
        value={q} onChangeText={setQ} autoCapitalize="none"
      />
      <Text style={s.count}>{total} cartas a la venta — repetidas de los coleccionistas</Text>
      <FlatList
        data={data}
        keyExtractor={(c) => c.id}
        numColumns={3}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 30 }}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={s.cell} onPress={() => navigation.navigate('Carta', { id: c.id })}>
            <View style={s.imgBox}>
              {c.imageUrl ? <Image source={{ uri: thumbUrl(c.imageUrl) }} style={s.img} resizeMode="contain" /> : null}
              <View style={s.stock}><Text style={s.stockTxt}>{c.totalStock} disp.</Text></View>
            </View>
            <Text style={s.name} numberOfLines={1}>{c.name}</Text>
            <Text style={s.price}>{c.minPrice != null ? clp(c.minPrice) + ' CLP' : '—'}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>Nada a la venta todavía — publica tus repetidas desde la web.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg, padding: 14 },
  search: {
    backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 8,
  },
  count: { color: T.muted, fontSize: 12, marginBottom: 10 },
  cell: { flex: 1 / 3 },
  imgBox: { aspectRatio: 63 / 88, backgroundColor: T.card, borderRadius: 8, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  stock: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(5,150,105,0.92)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  stockTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  name: { color: T.text, fontSize: 12, fontWeight: '700', marginTop: 5 },
  price: { color: T.accent, fontSize: 12, fontWeight: '800' },
  empty: { color: T.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
});
