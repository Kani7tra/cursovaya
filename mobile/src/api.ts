// Клиент общего REST API сервера «ГигаКузня»
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SERVER_KEY = 'gk_server';
const TOKEN_KEY = 'gk_token';

let baseUrl = '';
let token: string | null = null;

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

// Адрес сервера по умолчанию: IP компьютера, на котором запущен Expo, порт 5000
export function defaultServer() {
  const hostUri: string | undefined = (Constants.expoConfig as any)?.hostUri;
  const host = hostUri ? hostUri.split(':')[0] : '';
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) ? `http://${host}:5000` : 'http://192.168.0.100:5000';
}

export async function loadSettings() {
  try {
    baseUrl = (await AsyncStorage.getItem(SERVER_KEY)) || defaultServer();
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    baseUrl = defaultServer();
  }
  return { server: baseUrl, token };
}

export const getServer = () => baseUrl;

export async function setServer(url: string) {
  baseUrl = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(baseUrl)) baseUrl = 'http://' + baseUrl;
  try { await AsyncStorage.setItem(SERVER_KEY, baseUrl); } catch { /* не сохранилось */ }
  return baseUrl;
}

export async function setToken(t: string | null) {
  token = t;
  try {
    if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch { /* не сохранилось */ }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, `Нет связи с сервером ${baseUrl}. Проверьте, что сервер запущен и телефон в той же Wi-Fi сети.`);
  } finally {
    clearTimeout(timer);
  }
  let data: any = {};
  try { data = await res.json(); } catch { /* пустой ответ */ }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Ошибка запроса', data.fields);
  return data as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T = any>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  patch: <T = any>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  del: <T = any>(url: string) => request<T>('DELETE', url),
};

// Строка запроса без URLSearchParams (он не полностью поддерживается в React Native)
export function qs(params: Record<string, string | number | undefined | null>) {
  const parts = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`);
  return parts.length ? '?' + parts.join('&') : '';
}

// ---------- Типы данных ----------
export type User = {
  user_id: number; full_name: string; phone: string | null; email: string;
  role_id: number; role: string; is_blocked: boolean; bonus_points: number;
};

export type Product = {
  product_id: number; title: string; description: string | null; material: string; type: string;
  base_price: number; current_price: number; price: number; photo: string | null;
  is_seasonal: boolean; discount: { title: string; saved: number } | null; is_favorite: boolean;
  rating: number; reviews_count: number;
  season?: { start_date: string; end_date: string } | null;
  reviews?: { review_id: number; user_id: number; full_name: string; rating: number; comment: string | null; created_at: string }[];
};

export type Preorder = {
  preorder_id: number; user_id: number; full_name: string; phone: string | null; email: string;
  product_id: number; product_title: string; desired_date: string; comment: string | null;
  status: string; created_at: string; final_price: number; points_used: number;
};

export type Quote = {
  available_points: number; price: number; discount: { title: string; saved: number } | null;
  after_discount: number; points_used: number; points_saved: number; final_price: number;
};

export const ROLES = { ADMIN: 1, SMITH: 2, CUSTOMER: 3 };
