// Фирменные цвета «ГигаКузня» (совпадают с веб-приложением)
export const C = {
  bg: '#f5f0e8',
  paper: '#fffdf9',
  ink: '#1f1b18',
  ink2: '#4a423b',
  muted: '#857a6f',
  line: '#e4d9cb',
  line2: '#d4c6b4',
  iron: '#211d1a',
  iron2: '#2e2925',
  iron3: '#463e37',
  ember: '#d0571f',
  emberSoft: '#fbe6d8',
  gold: '#c98a2b',
  ok: '#2f7a4b',
  okSoft: '#e1f1e6',
  danger: '#b3261e',
  dangerSoft: '#fbe3e1',
  info: '#ece6dc',
  blue: '#1f4f82',
  blueSoft: '#dfeaf6',
  light: '#f4e9dc',
};

export const STATUS_COLORS: Record<string, [string, string]> = {
  'Новый': ['#dfeaf6', '#1f4f82'],
  'Принят': ['#efe0f6', '#6a2a85'],
  'В работе': ['#fff0d4', '#8a5a00'],
  'Готов': ['#e0f3f1', '#1d6b63'],
  'Отгружен': ['#e1f1e6', '#2f7a4b'],
  'Отменён': ['#fbe3e1', '#b3261e'],
};

export const STATUSES = ['Новый', 'Принят', 'В работе', 'Готов', 'Отгружен', 'Отменён'];
