export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  suggestions?: string[];
  timestamp: string;
  isSystem?: boolean;
}

export interface OrderHistoryItem {
  title: string;
  time: string;
}

export interface Order {
  id: string; // e.g. "IL-8392-MX"
  status: string; // e.g. "בדרך אליך", "נמסר", "במיון במרכז הלוגיסטי"
  statusKey: 'on_the_way' | 'delivered' | 'sorting' | 'issue';
  estimatedDelivery: string;
  driver?: {
    name: string;
    phone: string;
  };
  items: string;
  deliveryAddress: string;
  notes: string;
  issues?: string;
  history?: OrderHistoryItem[];
}
