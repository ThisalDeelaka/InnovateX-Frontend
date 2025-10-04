import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Kiosk, LiveBasket, Incident, KioskId } from '../types';

const SOCKET_URL = 'http://localhost:5000';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [kiosks, setKiosks] = useState<Record<KioskId, Kiosk['status']>>({
    SCC1: 'idle',
    SCC2: 'idle',
    SCC3: 'idle',
    SCC4: 'idle',
    RC1: 'idle',
  });
  const [currentBasket, setCurrentBasket] = useState<LiveBasket | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('kiosk:status', (data: { kioskId: KioskId; status: Kiosk['status'] }) => {
      setKiosks(prev => ({
        ...prev,
        [data.kioskId]: data.status,
      }));
    });

    socket.on('basket:update', (data: LiveBasket) => {
      setCurrentBasket(data);
    });

    socket.on('incident:new', (data: Incident) => {
      setIncidents(prev => [data, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    isConnected,
    kiosks,
    currentBasket,
    incidents,
  };
}
