export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  bio?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  size: string;
  sugar: string;
  milk: string;
  temp: string;
  notes: string;
  img?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalPrice: number;
  orderTime: string;
  buyerName: string;
  buyerUsername: string; // "guest" or username of logged in user
  type: 'dine-in' | 'take-away';
}

