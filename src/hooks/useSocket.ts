import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Kiosk, LiveBasket, Incident, KioskId } from '../types';

const SOCKET_URL = 'http://localhost:4000'; // backend server

type BackendLivePayload = {
  station: string; // kioskId
  live: {
    pos: Array<{ sku?: string; product_name?: string; price?: number; weight_g?: number }>;
    rfid: Array<{ sku?: string; epc?: string; location?: string }>;
    vision: Array<{ predicted_product?: string; accuracy?: number }>;
    queue: { customer_count?: number; average_dwell_time?: number };
    score: number; // 0..1
  };
};

type BackendIncidentPayload = {
  time: string;     // ISO
  station: string;  // kioskId
  type: string;
  reason: string;
  score: number;    // 0..1
  evidence: string[];
};

const initialKiosks: Record<KioskId, Kiosk['status']> = {
  SCC1: 'idle',
  SCC2: 'idle',
  SCC3: 'idle',
  SCC4: 'idle',
  RC1: 'idle',
};

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [kiosks, setKiosks] = useState<Record<KioskId, Kiosk['status']>>(initialKiosks);
  const [currentBasket, setCurrentBasket] = useState<LiveBasket | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // derive kiosk status from score + activity (simple rules)
  const deriveStatus = (score: number): Kiosk['status'] => {
    if (score >= 0.85) return 'alert';
    if (score > 0) return 'active';
    return 'idle';
  };

  // transform backend "live" payload to your LiveBasket shape
  const buildBasket = (station: string, live: BackendLivePayload['live']): LiveBasket => {
    const byKey = new Map<string, { name: string; quantity: number; price: number; pos?: boolean; rfid?: boolean; vision?: boolean; weight?: boolean }>();

    // POS as primary for name/price
    for (const x of live.pos) {
      const key = x.sku ?? x.product_name ?? `POS-${Math.random()}`;
      byKey.set(key, {
        name: x.product_name ?? key,
        quantity: 1,
        price: typeof x.price === 'number' ? x.price : 0,
        pos: true,
        rfid: false,
        vision: false,
        weight: x.weight_g != null,
      });
    }
    // RFID presence
    for (const r of live.rfid) {
      const key = r.sku ?? r.epc ?? `RFID-${Math.random()}`;
      const cur = byKey.get(key) ?? { name: key, quantity: 1, price: 0, pos: false, rfid: false, vision: false, weight: false };
      cur.rfid = true;
      byKey.set(key, cur);
    }
    // Vision presence
    for (const v of live.vision) {
      const key = v.predicted_product ?? `VISION-${Math.random()}`;
      const cur = byKey.get(key) ?? { name: key, quantity: 1, price: 0, pos: false, rfid: false, vision: false, weight: false };
      cur.vision = true;
      byKey.set(key, cur);
    }

    const items = Array.from(byKey.values());
    return {
      kioskId: station as KioskId,
      consensusScore: live.score,
      items,
      timestamp: new Date().toISOString(),
    };
  };

  // severity mapping from score
  const mapSeverity = (score: number): Incident['severity'] => {
    if (score >= 0.85) return 'critical';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
    };

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // ✅ backend emits "live": { station, live }
    socket.on('live', (payload: BackendLivePayload) => {
      const station = payload.station as KioskId;
      // update kiosk status (computed locally)
      setKiosks(prev => ({
        ...prev,
        [station]: deriveStatus(payload.live.score),
      }));
      // update basket (latest seen)
      setCurrentBasket(buildBasket(station, payload.live));
    });

    // ✅ backend emits "incident": backend format -> your Incident
    socket.on('incident', (inc: BackendIncidentPayload) => {
      const mapped: Incident = {
        id: `inc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        kioskId: inc.station as KioskId,
        severity: mapSeverity(inc.score),
        reason: inc.reason,
        evidence: inc.evidence ?? [],
        timestamp: inc.time,
      };
      setIncidents(prev => [mapped, ...prev].slice(0, 50));
    });

    return () => { socket.disconnect(); };
  }, []);

  return { isConnected, kiosks, currentBasket, incidents };
}
