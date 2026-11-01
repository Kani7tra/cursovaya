// Расчёт цены изделия: базовая / сезонная цена → скидка → списание баллов
const { query } = require('./db');
const config = require('./config');

// SQL-выражение действующей цены: активная сезонная цена на сегодня или базовая
const CURRENT_PRICE_SQL = `
  COALESCE((
    SELECT sp.seasonal_price FROM seasonal_prices sp
    WHERE sp.product_id = p.product_id AND sp.is_active
      AND CURRENT_DATE BETWEEN sp.start_date AND sp.end_date
    ORDER BY sp.seasonal_price_id DESC LIMIT 1
  ), p.base_price)`;

const round2 = (n) => Math.round(n * 100) / 100;

// Действующие сегодня скидки, применимые к пользователю (общие + персональные)
async function activeDiscounts(userId) {
  return query(
    `SELECT discount_id, title, discount_type, amount::float AS amount, product_id, user_id
       FROM discounts
      WHERE is_active AND CURRENT_DATE BETWEEN start_date AND end_date
        AND (user_id IS NULL OR user_id = $1)`,
    [userId || 0]
  );
}

// Выбирает самую выгодную скидку для изделия
function bestDiscount(price, productId, discounts) {
  let best = null;
  for (const d of discounts) {
    if (d.product_id && d.product_id !== productId) continue;
    const value = d.discount_type === 'percent' ? price * d.amount / 100 : d.amount;
    const saved = Math.min(value, price);
    if (!best || saved > best.saved) best = { ...d, saved: round2(saved) };
  }
  return best;
}

// Полный расчёт итоговой цены
// Формула: Итог = (Цена − Скидка) × (1 − min(Баллы, 30) / 100)
function calculate(price, discount, points) {
  const afterDiscount = round2(Math.max(0, price - (discount ? discount.saved : 0)));
  const usedPoints = Math.max(0, Math.min(points || 0, config.pointsMaxPercent));
  const pointsSaved = round2(afterDiscount * usedPoints / 100);
  return {
    price: round2(price),
    discount: discount ? { title: discount.title, saved: discount.saved } : null,
    after_discount: afterDiscount,
    points_used: usedPoints,
    points_saved: pointsSaved,
    final_price: round2(afterDiscount - pointsSaved),
  };
}

// Сколько баллов начислить за выполненный заказ: 10 баллов за каждые полные 1000 ₽
const pointsForOrder = (finalPrice) => Math.floor(finalPrice / 1000) * config.pointsPer1000;

module.exports = { CURRENT_PRICE_SQL, activeDiscounts, bestDiscount, calculate, pointsForOrder, round2 };
