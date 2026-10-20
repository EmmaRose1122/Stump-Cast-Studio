import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CardCommandSchema, ServerMessageSchema } from '@stumpcast/shared';
import { useAdmin } from '../store';
import { monitor } from './monitor';
import type { AlarmState } from './api';

const BACKOFF = [500, 1000, 2000, 5000, 10000];

/**
 * Preview WebSocket (`?preview=1`: undelayed). Keeps the alarm, ON AIR card and query caches
 * fresh, and reconnects forever with backoff.
 */
export const useLiveSocket = (): void => {
  const qc = useQueryClient();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let airTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const { setAlarm, setOnAirCard, setWsConnected } = useAdmin.getState();

    const connect = () => {
      if (stopped) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?preview=1`);
      ws.onopen = () => {
        attempt = 0;
        setWsConnected(true);
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            channels: ['state', 'events', 'cards', 'health', 'sound'],
          }),
        );
        void qc.invalidateQueries();
      };
      ws.onmessage = (e) => {
        let data: unknown;
        try {
          data = JSON.parse(String(e.data));
        } catch {
          return; // a heartbeat, proxy error page or partial frame must not kill the socket handler
        }
        const msg = ServerMessageSchema.safeParse(data);
        if (!msg.success || msg.data.type !== 'message') return;
        const { channel, event, payload } = msg.data;
        if (channel === 'health') {
          if (event === 'alarm') setAlarm(payload as AlarmState);
          void qc.invalidateQueries({ queryKey: ['provider'] });
        } else if (channel === 'sound') {
          monitor.handle(payload);
          void qc.invalidateQueries({ queryKey: ['sounds'] });
        } else if (channel === 'state') {
          void qc.invalidateQueries({ queryKey: ['matches'] });
        } else if (channel === 'cards') {
          const c = CardCommandSchema.safeParse(payload);
          if (!c.success) return;
          if (airTimer) clearTimeout(airTimer);
          if (c.data.action === 'show') {
            setOnAirCard(c.data.cardId);
            if (c.data.durationSec > 0) {
              airTimer = setTimeout(() => setOnAirCard(null), c.data.durationSec * 1000);
            }
          } else if (c.data.action === 'hide') {
            setOnAirCard(null);
          }
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        if (stopped) return;
        timer = setTimeout(connect, BACKOFF[Math.min(attempt, BACKOFF.length - 1)]);
        attempt++;
      };
      ws.onerror = () => undefined;
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (airTimer) clearTimeout(airTimer);
      ws?.close();
    };
  }, [qc]);
};
