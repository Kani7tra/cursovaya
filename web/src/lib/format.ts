// Форматирование значений и клиентская валидация (дублирует правила сервера)
export const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) + '\u00a0₽';

export const date = (s: string | null | undefined) =>
  s ? new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('ru-RU') : '—';

export const dateTime = (s: string) =>
  new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const time = (s: string) => new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const todayISO = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('sv-SE'); // формат ГГГГ-ММ-ДД
};

export const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const STATUS_CLASS: Record<string, string> = {
  'Новый': 'st-new', 'Принят': 'st-accepted', 'В работе': 'st-work',
  'Готов': 'st-ready', 'Отгружен': 'st-done', 'Отменён': 'st-cancel',
};

type Errors = Record<string, string>;

export const rules = {
  fullName: (v: string) =>
    !v.trim() ? 'Укажите ФИО'
      : !/^[А-ЯЁа-яёA-Za-z][А-ЯЁа-яёA-Za-z\s\-.]{1,127}$/.test(v.trim()) ? 'Только буквы, пробел и дефис, от 2 до 128 символов' : '',
  phone: (v: string, required = true) => {
    const c = v.replace(/[\s()-]/g, '');
    if (!c) return required ? 'Укажите телефон' : '';
    return /^\+?[0-9]{10,15}$/.test(c) ? '' : 'От 10 до 15 цифр, допускается «+» в начале';
  },
  email: (v: string) =>
    !v.trim() ? 'Укажите e-mail' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || v.length > 64 ? 'Неверный формат e-mail (пример: name@mail.ru)' : '',
  password: (v: string) =>
    v.length < 6 ? 'Не менее 6 символов'
      : v.length > 64 ? 'Не более 64 символов'
        : !/[A-Za-zА-Яа-яЁё]/.test(v) || !/\d/.test(v) ? 'Пароль должен содержать буквы и цифры' : '',
  required: (v: string, label: string) => (!String(v ?? '').trim() ? `Заполните поле «${label}»` : ''),
};

// Убирает пустые сообщения; возвращает null, если ошибок нет
export function collect(errors: Errors): Errors | null {
  const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
  return Object.keys(clean).length ? clean : null;
}

// Уменьшение фото перед сохранением в БД (data URL, JPEG)
export function resizeImage(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return reject(new Error('Выберите изображение PNG, JPG или WEBP'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Файл больше 10 МБ'));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
