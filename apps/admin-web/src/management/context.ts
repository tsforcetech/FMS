import { useEffect, useState } from 'react';
import type { Company, Kind } from '@facilityos/shared';
import type { FirebaseServices } from '../firebase';
import { recordById } from './store';

export type Context = {
  services: FirebaseServices;
  company: Company;
  uid: string;
  role: string;
};
const cache = new Map<string, Promise<{ name: string; code: string } | null>>();
export function clearLabelCache() {
  cache.clear();
}
export function lookup(context: Context, kind: Kind, id: string) {
  const key = `${context.company.companyId}/${kind}/${id}`;
  if (!cache.has(key))
    cache.set(
      key,
      recordById(context.services.db, context.company.companyId, kind, id)
        .then((r) => (r ? { name: r.values.name, code: r.values.code } : null))
        .catch(() => {
          cache.delete(key);
          return null;
        }),
    );
  return cache.get(key)!;
}
/** Resolves a linked record's display name, cached per company. */
export function useLabel(context: Context, kind: Kind | undefined, id: string) {
  const [label, setLabel] = useState<{ name: string; code: string } | null>();
  useEffect(() => {
    let active = true;
    if (!kind || !id) return;
    lookup(context, kind, id).then((r) => {
      if (active) setLabel(r);
    });
    return () => {
      active = false;
    };
  }, [context, kind, id]);
  if (!kind || !id) return { text: '—', loading: false, record: null };
  if (label === undefined)
    return { text: 'Loading…', loading: true, record: null };
  return {
    text: label ? label.name : 'Unavailable record',
    loading: false,
    record: label,
  };
}
export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
export function greeting(timeZone: string) {
  let hour = new Date().getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone,
      }).format(new Date()),
    );
  } catch {
    /* fall back to local time */
  }
  return hour < 12
    ? 'Good morning'
    : hour < 18
      ? 'Good afternoon'
      : 'Good evening';
}
export function formatDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date(v + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export function formatInstant(d: Date) {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
