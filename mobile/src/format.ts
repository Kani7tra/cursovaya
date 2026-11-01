// Форматирование и валидация (без Intl — для надёжной работы на любом телефоне)
const pad = (n: number) => String(n).padStart(2, '0');

export function money(n: number) {
  const fixed = Math.round(n * 100) / 100;
  const [int, frac] = String(fixed).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (frac ? ',' + frac.padEnd(2, '0') : '') + ' ₽';
}

function toDate(s: string) {
  return new Date(s.length === 10 ? s + 'T00:00:00' : s);
}

export function date(s?: string | null) {
  if (!s) return '—';
  const d = toDate(s);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function dateTime(s: string) {
  const d = toDate(s);
  return `${date(s)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function time(s: string) {
  const d = toDate(s);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Дата через N дней в формате ГГГГ-ММ-ДД
export function isoAfter(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ДД.ММ.ГГГГ → ГГГГ-ММ-ДД (или null, если дата некорректна)
export function parseRuDate(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime()) || d.getDate() !== Number(m[1]) || d.getMonth() + 1 !== Number(m[2])) return null;
  return iso;
}

export const ruFromIso = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

export const rules = {
  fullName: (v: string) =>
    !v.trim() ? 'Укажите ФИО'
      : !/^[А-ЯЁа-яёA-Za-z][А-ЯЁа-яёA-Za-z\s\-.]{1,127}$/.test(v.trim()) ? 'Только буквы, пробел и дефис, от 2 до 128 символов' : '',
  phone: (v: string) => {
    const c = v.replace(/[\s()-]/g, '');
    if (!c) return 'Укажите телефон';
    return /^\+?[0-9]{10,15}$/.test(c) ? '' : 'От 10 до 15 цифр, допускается «+» в начале';
  },
  email: (v: string) =>
    !v.trim() ? 'Укажите e-mail' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || v.length > 64 ? 'Неверный формат e-mail (пример: name@mail.ru)' : '',
  password: (v: string) =>
    v.length < 6 ? 'Не менее 6 символов'
      : v.length > 64 ? 'Не более 64 символов'
        : !/[A-Za-zА-Яа-яЁё]/.test(v) || !/\d/.test(v) ? 'Пароль должен содержать буквы и цифры' : '',
};

export function collect(errors: Record<string, string>): Record<string, string> | null {
  const clean: Record<string, string> = {};
  Object.keys(errors).forEach((k) => { if (errors[k]) clean[k] = errors[k]; });
  return Object.keys(clean).length ? clean : null;
}
