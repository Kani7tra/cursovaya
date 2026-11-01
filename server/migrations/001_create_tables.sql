-- =====================================================================
-- ИС «ГигаКузня». Миграция 001: создание таблиц
-- СУБД: PostgreSQL 14+
-- Структура соответствует физической ER-модели (roles, users, products,
-- seasonal_prices, discounts, preorders, favorites, messages, reviews)
-- и дополнена журналом событий logs (мониторинг для администратора).
-- =====================================================================

-- Роли пользователей
CREATE TABLE roles (
    role_id   SERIAL PRIMARY KEY,
    title     VARCHAR(32) NOT NULL UNIQUE
);

-- Пользователи (администратор, кузнец, заказчик)
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    full_name     VARCHAR(128) NOT NULL,
    phone         VARCHAR(16),
    email         VARCHAR(64)  NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL,              -- хэш scrypt (соль + хэш)
    role_id       INT          NOT NULL REFERENCES roles(role_id),
    is_blocked    BOOLEAN      NOT NULL DEFAULT FALSE,
    bonus_points  INT          NOT NULL DEFAULT 0 CHECK (bonus_points >= 0)
);

-- Кузнечные изделия (каталог). Фото хранится внутри БД (data URL).
CREATE TABLE products (
    product_id   SERIAL PRIMARY KEY,
    title        VARCHAR(128)   NOT NULL,
    description  TEXT,
    material     VARCHAR(60)    NOT NULL,
    type         VARCHAR(64)    NOT NULL,
    base_price   DECIMAL(10, 2) NOT NULL CHECK (base_price > 0),
    photo        TEXT
);

-- Сезонные цены
CREATE TABLE seasonal_prices (
    seasonal_price_id  SERIAL PRIMARY KEY,
    product_id         INT            NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    seasonal_price     DECIMAL(10, 2) NOT NULL CHECK (seasonal_price > 0),
    start_date         DATE           NOT NULL,
    end_date           DATE           NOT NULL,
    is_active          BOOLEAN        NOT NULL DEFAULT TRUE,
    CHECK (end_date >= start_date)
);

-- Скидки (общие, на изделие, персональные)
CREATE TABLE discounts (
    discount_id    SERIAL PRIMARY KEY,
    title          VARCHAR(128)   NOT NULL,
    discount_type  VARCHAR(16)    NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    amount         DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    product_id     INT REFERENCES products(product_id) ON DELETE CASCADE,  -- NULL = на все изделия
    user_id        INT REFERENCES users(user_id) ON DELETE CASCADE,        -- NULL = для всех заказчиков
    start_date     DATE           NOT NULL,
    end_date       DATE           NOT NULL,
    is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
    CHECK (end_date >= start_date),
    CHECK (discount_type <> 'percent' OR amount <= 100)
);

-- Предзаказы
CREATE TABLE preorders (
    preorder_id   SERIAL PRIMARY KEY,
    user_id       INT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id    INT            NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    desired_date  TIMESTAMP      NOT NULL,
    comment       TEXT,
    status        VARCHAR(32)    NOT NULL DEFAULT 'Новый'
                  CHECK (status IN ('Новый', 'Принят', 'В работе', 'Готов', 'Отгружен', 'Отменён')),
    created_at    TIMESTAMP      NOT NULL DEFAULT NOW(),
    final_price   DECIMAL(10, 2) NOT NULL CHECK (final_price >= 0),   -- итоговая цена с учётом скидок и баллов
    points_used   INT            NOT NULL DEFAULT 0 CHECK (points_used >= 0)
);

-- Избранное
CREATE TABLE favorites (
    favorite_id  SERIAL PRIMARY KEY,
    user_id      INT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id   INT       NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    added_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- Сообщения между заказчиком и кузнецом
CREATE TABLE messages (
    message_id    SERIAL PRIMARY KEY,
    sender_id     INT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id   INT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_text  TEXT      NOT NULL,
    send_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    is_read       BOOLEAN   NOT NULL DEFAULT FALSE,
    CHECK (sender_id <> receiver_id)
);

-- Отзывы об изделиях
CREATE TABLE reviews (
    review_id   SERIAL PRIMARY KEY,
    user_id     INT       NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id  INT       NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    rating      INT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- Журнал событий и ошибок (мониторинг системы)
CREATE TABLE logs (
    log_id      SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,
    level       VARCHAR(16)  NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
    action      VARCHAR(64)  NOT NULL,
    details     TEXT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preorders_user    ON preorders(user_id);
CREATE INDEX idx_preorders_status  ON preorders(status);
CREATE INDEX idx_messages_pair     ON messages(sender_id, receiver_id);
CREATE INDEX idx_seasonal_product  ON seasonal_prices(product_id);
CREATE INDEX idx_reviews_product   ON reviews(product_id);
