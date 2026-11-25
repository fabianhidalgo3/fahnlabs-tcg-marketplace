import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * API de SingleTCG. Se AUTODETECTA: usa el host desde el que Expo sirve la app
 * (el Mac), así funciona igual en simulador, web y en tu iPhone con Expo Go
 * dentro de la misma red — sin tocar nada.
 */
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL = `http://${expoHost ?? 'localhost'}:8099/api`;

const TOKEN_KEY = 'tcg_token';
const USER_KEY = 'tcg_user';

export interface AuthUser { id: string; email: string; name: string; role: 'admin' | 'customer'; }

export async function getToken() { return AsyncStorage.getItem(TOKEN_KEY); }
export async function getUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export async function saveSession(token: string, user: AuthUser) {
  await AsyncStorage.multiSet([[TOKEN_KEY, token], [USER_KEY, JSON.stringify(user)]]);
}
export async function clearSession() { await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]); }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? `Error ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  summary: () => request<any>('/collection/summary'),
  myCards: (params: Record<string, string | number | undefined>) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return request<any>(`/collection/cards?${qs}`);
  },
  adjust: (cardModelId: string, variant: string, language: 'EN' | 'ES', delta: number) =>
    request<{ quantity: number }>('/collection/adjust', {
      method: 'POST',
      body: JSON.stringify({ cardModelId, variant, language, delta }),
    }),
  myCopies: (cardId: string) => request<any>(`/collection/cards/${cardId}/mine`),

  cards: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return request<any>(`/cards?${qs}`);
  },
  card: (id: string) => request<any>(`/cards/${id}`),
  priceHistory: (id: string) => request<any[]>(`/cards/${id}/price-history`),
  rates: () => request<{ usdClp: number; date: string }>('/config/rates'),

  scan: (imageBase64: string, mediaType = 'image/jpeg') =>
    request<any>('/cards/scan', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64, mediaType }),
    }),
  importWeb: (apiId: string) =>
    request<any>('/cards/import-web', { method: 'POST', body: JSON.stringify({ apiId }) }),
};

/** Miniatura liviana (misma lógica que la web). */
export function thumbUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.includes('images.scrydex.com')) return url.replace(/\/large$/, '/small');
  return url.replace('_hires.png', '.png');
}
