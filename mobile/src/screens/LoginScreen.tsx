import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth';
import { T } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try { await login(email.trim(), password); }
    catch (e: any) { setError(e?.message ?? 'No se pudo entrar'); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.brandRow}>
        <View style={s.fan}>
          <View style={[s.mini, { backgroundColor: T.accentDeep, transform: [{ rotate: '-16deg' }], left: 0 }]} />
          <View style={[s.mini, { backgroundColor: '#14b8a6', transform: [{ rotate: '16deg' }], right: 0 }]} />
          <View style={[s.mini, s.miniCenter]} />
        </View>
        <View>
          <Text style={s.brand}>
            <Text style={{ color: T.primary }}>Single</Text>
            <Text style={{ color: T.accent }}>TCG</Text>
          </Text>
          <Text style={s.byline}>by FHAN Labs</Text>
        </View>
      </View>

      <Text style={s.title}>Entrar</Text>
      <Text style={s.hint}>Demo: cliente@tcg.local / cliente123</Text>

      <Text style={s.label}>Email</Text>
      <TextInput
        style={s.input} placeholder="tu@correo.com" placeholderTextColor={T.muted}
        autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}
      />
      <Text style={s.label}>Contraseña</Text>
      <TextInput
        style={s.input} placeholder="••••••••" placeholderTextColor={T.muted}
        secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit}
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Entrar</Text>}
      </TouchableOpacity>

      <Text style={s.foot}>SingleTCG · un producto de FHAN Labs</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', padding: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30, alignSelf: 'center' },
  fan: { width: 54, height: 44 },
  mini: { position: 'absolute', top: 8, width: 22, height: 30, borderRadius: 4 },
  miniCenter: { backgroundColor: T.primaryDeep, left: 16, top: 2, width: 22, height: 32, borderRadius: 4 },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  byline: { color: T.muted, fontSize: 11, fontWeight: '600' },
  title: { color: T.text, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  hint: { color: T.muted, fontSize: 12, marginBottom: 20 },
  label: { color: T.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  error: { color: T.danger, marginTop: 12, fontSize: 13 },
  btn: { backgroundColor: T.primaryDeep, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  foot: { color: T.muted, fontSize: 11, textAlign: 'center', marginTop: 26 },
});
