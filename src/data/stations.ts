// Charging station data - adjusted positions to avoid overlap with payment lines

export interface Station {
  id: number;
  name: string;
  brand: string;
  x: number;
  y: number;
  rate: number;
  power: number;
  available: boolean;
}

export interface RouterNode {
  id: string;
  name: string;
  x: number;
  y: number;
  liquidity: number;
}

export interface UserNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export const STATIONS: Station[] = [
  // rate (CKB/kWh) × power (kW) × 5s/3600 = amount per interval
  // Tesla:  1.44 × 250 × 5/3600 = 0.500 CKB/5s
  { id: 1, name: 'Tesla Supercharger', brand: 'Tesla', x: 12, y: 18, rate: 1.44, power: 250, available: true },
  // ChargePoint: 1.44 × 150 × 5/3600 = 0.300 CKB/5s
  { id: 2, name: 'ChargePoint', brand: 'ChargePoint', x: 78, y: 15, rate: 1.44, power: 150, available: true },
  // EVgo: 1.44 × 100 × 5/3600 = 0.200 CKB/5s
  { id: 3, name: 'EVgo Fast Charge', brand: 'EVgo', x: 82, y: 70, rate: 1.44, power: 100, available: false },
  // EA: 1.44 × 350 × 5/3600 = 0.700 CKB/5s
  { id: 4, name: 'Electrify America', brand: 'EA', x: 50, y: 78, rate: 1.44, power: 350, available: true },
  // Blink: 1.44 × 50 × 5/3600 = 0.100 CKB/5s
  { id: 5, name: 'Blink Charging', brand: 'Blink', x: 62, y: 42, rate: 1.44, power: 50, available: true },
];

export const ROUTER_NODE: RouterNode = { id: 'router', name: 'Fiber Hub', x: 50, y: 45, liquidity: 50000 };

export const USER_NODE: UserNode = { id: 'user', name: 'You', x: 12, y: 88 };
