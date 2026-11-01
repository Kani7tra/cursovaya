// Правила валидации входных данных (сервер проверяет всё повторно после клиента)
const { HttpError } = require('./router');

const RX = {
  fullName: /^[А-ЯЁа-яёA-Za-z][А-ЯЁа-яёA-Za-z\s\-.]{1,127}$/,
  phone: /^\+?[0-9]{10,15}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
};

// Собирает ошибки по полям; в конце вызывается check()
class Validator {
  constructor(data) {
    this.data = data || {};
    this.errors = {};
  }

  str(field) {
    const v = this.data[field];
    return v === undefined || v === null ? '' : String(v).trim();
  }

  required(field, label) {
    if (!this.str(field)) this.errors[field] = `Поле «${label}» обязательно для заполнения`;
    return this;
  }

  fullName(field = 'full_name') {
    const v = this.str(field);
    if (!v) this.errors[field] = 'Укажите ФИО';
    else if (!RX.fullName.test(v)) this.errors[field] = 'ФИО: только буквы, пробел и дефис, от 2 до 128 символов';
    return this;
  }

  phone(field = 'phone', required = true) {
    const v = this.str(field).replace(/[\s()-]/g, '');
    if (!v) { if (required) this.errors[field] = 'Укажите телефон'; }
    else if (!RX.phone.test(v)) this.errors[field] = 'Телефон: от 10 до 15 цифр, допускается «+» в начале';
    return this;
  }

  email(field = 'email') {
    const v = this.str(field);
    if (!v) this.errors[field] = 'Укажите e-mail';
    else if (v.length > 64 || !RX.email.test(v)) this.errors[field] = 'Неверный формат e-mail (пример: name@mail.ru)';
    return this;
  }

  password(field = 'password') {
    const v = this.str(field);
    if (v.length < 6) this.errors[field] = 'Пароль должен содержать не менее 6 символов';
    else if (v.length > 64) this.errors[field] = 'Пароль не должен быть длиннее 64 символов';
    else if (!/[A-Za-zА-Яа-яЁё]/.test(v) || !/\d/.test(v)) this.errors[field] = 'Пароль должен содержать буквы и цифры';
    return this;
  }

  maxLen(field, max, label) {
    if (this.str(field).length > max) this.errors[field] = `«${label}»: не более ${max} символов`;
    return this;
  }

  number(field, label, { min = -Infinity, max = Infinity, integer = false, required = true } = {}) {
    const raw = this.str(field);
    if (!raw) { if (required) this.errors[field] = `Укажите «${label}»`; return this; }
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) this.errors[field] = `«${label}» должно быть числом`;
    else if (integer && !Number.isInteger(n)) this.errors[field] = `«${label}» должно быть целым числом`;
    else if (n < min) this.errors[field] = `«${label}» не может быть меньше ${min}`;
    else if (n > max) this.errors[field] = `«${label}» не может быть больше ${max}`;
    return this;
  }

  date(field, label, required = true) {
    const v = this.str(field);
    if (!v) { if (required) this.errors[field] = `Укажите «${label}»`; }
    else if (!RX.date.test(v) || Number.isNaN(Date.parse(v))) this.errors[field] = `«${label}»: неверная дата`;
    return this;
  }

  oneOf(field, values, label) {
    if (!values.includes(this.str(field))) this.errors[field] = `Недопустимое значение поля «${label}»`;
    return this;
  }

  custom(field, condition, message) {
    if (!this.errors[field] && !condition) this.errors[field] = message;
    return this;
  }

  check() {
    if (Object.keys(this.errors).length) {
      throw new HttpError(400, 'Проверьте правильность заполнения полей', this.errors);
    }
  }
}

const cleanPhone = (v) => (v ? String(v).replace(/[\s()-]/g, '') : null);
const toNumber = (v) => (v === undefined || v === null || v === '' ? null : Number(String(v).replace(',', '.')));
const toId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Некорректный идентификатор');
  return n;
};

module.exports = { Validator, cleanPhone, toNumber, toId };
