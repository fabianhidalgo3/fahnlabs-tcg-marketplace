import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth';
import { T } from '../theme';

export default function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [rate, setRate] = useState(940);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.summary().then(setSummary).catch(() => undefined);
    api.rates().then((r) => setRate(r.usdClp)).catch(() => undefined);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const clp = (usd: number) => '$' + Math.round(usd * rate).toLocaleString('es-CL') + ' CLP';

  return (
    <ScrollView
      style={s.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.muted} onRefresh={() => { setRefreshing(true); load(); setTimeout(() => setRefreshing(false), 600); }} />}
    >
      <View style={s.hero}>
        <Text style={s.heroBrand}>SINGLETCG · BY FHAN LABS</Text>
        <Text style={s.heroTitle}>Hola, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={s.heroSub}>Tu colección, completa y viva.</Text>
      </View>

      {summary && (
        <>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={[s.statVal, { color: T.accent }]}>{clp(summary.collectionValue)}</Text>
              <Text style={s.statLbl}>valor colección</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statVal}>{summary.distinctSlots}</Text>
              <Text style={s.statLbl}>cartas distintas</Text>
            </View>
          </View>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{summary.totalCopies}</Text>
              <Text style={s.statLbl}>copias en total</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statVal}>{summary.sets}</Text>
              <Text style={s.statLbl}>sets en colección</Text>
            </View>
          </View>

          {summary.setsInProgress?.length > 0 && (
            <>
              <Text style={s.sec}>Sigue completando</Text>
              {summary.setsInProgress.map((p: any) => (
                <View key={p.id} style={s.pset}>
                  <View style={s.psetRow}>
                    <Text style={s.psetName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.psetPct}>{p.completionPercent}%</Text>
                  </View>
                  <View style={s.pbar}><View style={[s.pfill, { width: `${p.completionPercent}%` }]} /></View>
                  <Text style={s.psetSub}>{p.ownedSlots}/{p.totalSlots} · faltan {p.totalSlots - p.ownedSlots}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      <TouchableOpacity style={s.scanCta} onPress={() => navigation.navigate('Escanear')}>
        <Text style={s.scanIcon}>📷</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.scanTitle}>Escanea una carta</Text>
          <Text style={s.scanSub}>Apúntale con la cámara y se agrega sola a tu colección.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={s.logout} onPress={logout}>
        <Text style={{ color: T.muted, fontSize: 13 }}>Cerrar sesión ({user?.email})</Text>
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg, padding: 16 },
  hero: { borderRadius: T.radius, padding: 20, marginBottom: 14, backgroundColor: T.primaryDeep },
  heroBrand: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: T.radius, padding: 14 },
  statVal: { color: T.text, fontSize: 20, fontWeight: '800' },
  statLbl: { color: T.muted, fontSize: 12, marginTop: 2 },
  sec: { color: T.text, fontSize: 16, fontWeight: '800', marginVertical: 10 },
  pset: { backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: T.radius, padding: 14, marginBottom: 10 },
  psetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  psetName: { color: T.text, fontWeight: '700', flex: 1, marginRight: 8 },
  psetPct: { color: T.primary, fontWeight: '800' },
  pbar: { height: 6, backgroundColor: T.card2, borderRadius: 3, overflow: 'hidden' },
  pfill: { height: 6, backgroundColor: T.primary, borderRadius: 3 },
  psetSub: { color: T.muted, fontSize: 12, marginTop: 6 },
  scanCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    backgroundColor: T.card, borderColor: T.accentDeep, borderWidth: 1, borderRadius: T.radius, padding: 16,
  },
  scanIcon: { fontSize: 28 },
  scanTitle: { color: T.text, fontWeight: '800', fontSize: 15 },
  scanSub: { color: T.muted, fontSize: 12, marginTop: 2 },
  logout: { alignItems: 'center', marginTop: 22 },
});
