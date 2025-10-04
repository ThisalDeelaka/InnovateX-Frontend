export type KioskId = 'SCC1' | 'SCC2' | 'SCC3' | 'SCC4' | 'RC1';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface KioskPosition {
  x: number;
  y: number;
}

export interface Kiosk {
  id: KioskId;
  position: KioskPosition;
  status: 'active' | 'idle' | 'alert' | 'offline';
  isRegularCounter?: boolean;
}

export interface BasketItem {
  name: string;
  quantity: number;
  price: number;
  pos?: boolean;
  rfid?: boolean;
  vision?: boolean;
  weight?: boolean;
}

export interface LiveBasket {
  kioskId: KioskId;
  items: BasketItem[];
  consensusScore: number;
  timestamp: string;
}

export interface Incident {
  id: string;
  kioskId: KioskId;
  severity: SeverityLevel;
  reason: string;
  evidence: string[];
  timestamp: string;
}

export interface SimulationResponse {
  success: boolean;
  message: string;
}

export interface SocketEvents {
  'kiosk:status': (data: { kioskId: KioskId; status: Kiosk['status'] }) => void;
  'basket:update': (data: LiveBasket) => void;
  'incident:new': (data: Incident) => void;
  'system:health': (data: { status: string; uptime: number }) => void;
}
