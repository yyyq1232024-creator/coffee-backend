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
  avatar?: string;
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

export interface BeanBatch {
  id: string;
  lotCode: string;
  country: string;
  region: string;
  farm: string;
  altitude: string;
  variety: string;
  process: string;
  roastLevel: string;
  flavorNotes: string[];
  harvestSeason: string;
  roastedAt: string;
  status: 'active' | 'archived';
  story: string;
  image: string;
  latitude: number;
  longitude: number;
  profile: {
    producer: string;
    microRegion: string;
    terrain: string;
    temperature: string;
    rainfall: string;
    soil: string;
    harvestMethod: string;
    drying: string;
    moisture: string;
    screen: string;
    exporter: string;
    arrival: string;
    recommendedBrew: string;
    traceability: string[];
  };
}

export interface MenuProduct {
  id: number;
  name: string;
  price: number;
  category: 'coffee' | 'tea' | 'dessert';
  img: string;
  desc: string;
  stock: number;
  active: boolean;
  beanBatchId?: string | null;
  beanBatch?: BeanBatch | null;
}

export interface WishlistItem {
  wishId: string;
  itemId?: number;
  name: string;
  price: number;
  category: string;
  img: string;
  sugar: string;
  milk: string;
  temp: string;
  size: string;
  notes: string;
  addedAt: string;
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

export interface PrintJob {
  id: string;
  orderId?: string;
  ownerUserId?: string;
  buyerName: string;
  buyerUsername: string;
  totalPrice: number;
  items: {
    name: string;
    price: number;
    size: string;
    sugar: string;
    milk: string;
    temp: string;
    notes?: string;
  }[];
  timestamp: string;
  status: 'pending' | 'printing' | 'completed';
}

