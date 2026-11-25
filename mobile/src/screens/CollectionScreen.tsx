import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, thumbUrl } from '../api';
import { T } from '../theme';

export default function CollectionScreen({ navigation }: any) {
  const [q, setQ] = useState('');
  const [onlyDups, setOnlyDups] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [copies, setCopies] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback((p = 1, append = false) => {
    setLoading(true);
    api.myCards({ q, dups: onlyDups ? 'true' : undefined, page: p, limit: 24 })
      .then((r) => {
        setData((prev) => (append ? [...prev, ...r.data] : r.data));
        setTotal(r.total); setCopies(r.totalCopies ?? 0); setPage(p); setPages(r.totalPages);
      })
      .finally(() => setLoading(false));
  }, [q, onlyDups]);

  useEffect(() => { const t = setTimeout(() => load(1), 350); return () => clearTimeout(t); }, [load]);

  return (
    <View style={s.wrap}>
      <TextInput
        style={s.search} placeholder="Buscar: nombre, número o artista…" placeholderTextColor={T.muted}
        value={q} onChangeText={setQ} autoCapitalize="none"
      />
      <View style={s.bar}>
        <Text style={s.count}>{total} cartas · {copies} copias</Text>
        <View style={s.dupRow}>
          <Text style={s.dupLbl}>Solo repetidas</Text>
          <Switch value={onlyDups} onValueChange={setOnlyDups} trackColor={{ true: T.accentDeep }} thumbColor="#fff" />
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(c) => c.id + c.variant}
        numColumns={3}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 30 }}
        onEndReached={() => { if (page < pages && !loading) load(page + 1, true); }}
        onEndReachedThreshold={0.4}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={s.cell} onPress={() => navigation.navigate('Carta', { id: c.id })}>
            <View style={s.imgBox}>
              {c.imageUrl ? <Image source={{ uri: thumbUrl(c.imageUrl) }} style={s.img} resizeMode="contain" /> : null}
              <View style={s.qty}><Text style={s.qtyTxt}>×{c.quantity}</Text></View>
              {c.variant !== 'Normal' && (
                <View style={s.var}><Text style={s.varTxt}>{c.variant === 'Reverse Holo' ? 'Rev' : c.variant}</Text></View>
              )}
            </View>
            <Text style={s.name} numberOfLines={1}>{c.name}</Text>
            <Text style={s.sub} numberOfLines={1}>{c.set?.name} · {c.number}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? <Text style={s.empty}>No tienes cartas con ese filtro.</Text> : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg, padding: 14 },
  search: {
    backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 10,
  },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  count: { color: T.muted, fontSize: 12 },
  dupRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dupLbl: { color: T.muted, fontSize: 12, fontWeight: '600' },
  cell: { flex: 1 / 3 },
  imgBox: { aspectRatio: 63 / 88, backgroundColor: T.card, borderRadius: 8, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  qty: { position: 'absolute', top: 4, right: 4, backgroundColor: T.primaryDeep, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  qtyTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  var: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(124,58,237,0.9)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  varTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  name: { color: T.text, fontSize: 12, fontWeight: '700', marginTop: 5 },
  sub: { color: T.muted, fontSize: 10 },
  empty: { color: T.muted, textAlign: 'center', marginTop: 40 },
});
