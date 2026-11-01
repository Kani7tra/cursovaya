// Подключение к PostgreSQL через пул соединений
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

// Выполнить запрос и вернуть массив строк
async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// Вернуть первую строку или null
async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Запись в журнал событий (ошибки журнала не должны ронять запрос)
async function log(userId, action, details = '', level = 'info') {
  try {
    await pool.query(
      'INSERT INTO logs (user_id, level, action, details) VALUES ($1, $2, $3, $4)',
      [userId || null, level, action, String(details).slice(0, 2000)]
    );
  } catch (e) {
    console.error('Не удалось записать журнал:', e.message);
  }
}

module.exports = { pool, query, one, log };
