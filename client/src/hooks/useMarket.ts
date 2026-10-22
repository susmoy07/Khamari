import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { taka } from '../lib/format';
import { useToast } from '../context/ToastContext';
import type { Benchmark, Crop, Negotiation, Order, User } from '../lib/types';

const LIVE_EVENTS = [
  'bazaar:price_updated',
  'crop:listed',
  'crop:stock_updated',
  'negotiation:created',
  'negotiation:offer_updated',
  'negotiation:status_changed',
  'order:confirmed',
] as const;

export function useMarket(user: User) {
  const toast = useToast();
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLive, setLastLive] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [b, c, n, o] = await Promise.all([
        api.benchmarks(),
        user.role === 'FARMER'
          ? api.crops({ farmerId: user.id, status: 'ALL' })
          : api.crops({ status: 'AVAILABLE' }),
        api.negotiations(),
        api.orders(),
      ]);
      setBenchmarks(b);
      setCrops(c);
      setNegotiations(n);
      setOrders(o);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user.id, user.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const s = getSocket();
    const debounced = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refresh, 250);
    };
    const onPrice = (p: Benchmark) => {
      setLastLive(new Date().toISOString());
      toast(
        `Live Bazaar update: ${p.crop_category} in ${p.bazaar_region} now ${taka(p.min_price)} - ${taka(p.max_price)}`,
        'info'
      );
      debounced();
    };
    const onOrder = () => toast('Order confirmed. Receipt is ready in Orders.', 'success');
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    setConnected(s.connected);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('bazaar:price_updated', onPrice);
    s.on('order:confirmed', onOrder);
    for (const ev of LIVE_EVENTS) {
      if (ev !== 'bazaar:price_updated') s.on(ev, debounced);
    }
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('bazaar:price_updated', onPrice);
      s.off('order:confirmed', onOrder);
      for (const ev of LIVE_EVENTS) {
        if (ev !== 'bazaar:price_updated') s.off(ev, debounced);
      }
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh, toast]);

  return { benchmarks, crops, negotiations, orders, loading, error, lastLive, connected, refresh };
}
