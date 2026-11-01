// Миграции БД: создаёт базу (если её нет) и по порядку выполняет файлы migrations/*.sql.
// Выполненные миграции запоминаются в таблице schema_migrations и повторно не запускаются.
// Запуск: npm run migrate           — применить новые миграции
//         npm run migrate -- --reset — удалить все таблицы и создать заново (с демо-данными)
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('./config');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureDatabase() {
  const url = new URL(config.databaseUrl);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}" ENCODING 'UTF8' TEMPLATE template0`);
    console.log(`Создана база данных «${dbName}»`);
  }
  await admin.end();
}

async function migrate() {
  await ensureDatabase();
  const client = new Client({ connectionString: config.databaseUrl });
  await client.connect();

  if (process.argv.includes('--reset')) {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Все таблицы удалены (--reset)');
  }

  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✔ ${file}`);
      applied++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`  ✖ ${file}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
  console.log(applied ? `Применено миграций: ${applied}` : 'База данных в актуальном состоянии');
  await client.end();
}

migrate().catch((e) => {
  console.error('Ошибка миграции:', e.message);
  console.error('Проверьте, что PostgreSQL запущен и DATABASE_URL в файле server/.env указан верно.');
  process.exit(1);
});
