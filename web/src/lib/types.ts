export type User = {
  user_id: number;
  full_name: string;
  phone: string | null;
  email: string;
  role_id: number;
  role: string;
  is_blocked: boolean;
  bonus_points: number;
};

export type Product = {
  product_id: number;
  title: string;
  description: string | null;
  material: string;
  type: string;
  base_price: number;
  current_price: number;
  price: number;
  photo: string | null;
  is_seasonal: boolean;
  discount: { title: string; saved: number } | null;
  is_favorite: boolean;
  rating: number;
  reviews_count: number;
  season?: { start_date: string; end_date: string } | null;
  reviews?: Review[];
};

export type Review = {
  review_id: number;
  user_id: number;
  full_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Preorder = {
  preorder_id: number;
  user_id: number;
  full_name: string;
  phone: string | null;
  email: string;
  product_id: number;
  product_title: string;
  desired_date: string;
  comment: string | null;
  status: string;
  created_at: string;
  final_price: number;
  points_used: number;
};

export type Quote = {
  product: { product_id: number; title: string; current_price: number };
  available_points: number;
  price: number;
  discount: { title: string; saved: number } | null;
  after_discount: number;
  points_used: number;
  points_saved: number;
  final_price: number;
};

export type Info = {
  name: string;
  admin_email: string;
  phone: string;
  address: string;
  points_per_1000: number;
  points_max_percent: number;
};

export const STATUSES = ['Новый', 'Принят', 'В работе', 'Готов', 'Отгружен', 'Отменён'];
