'use client';
import { useEffect, useState, type ReactNode } from 'react';

const KEY = 'auth_last_method';
type Item = { key: string; node: ReactNode };

// The last method used (localStorage, this browser only) is listed first; the server order stands otherwise.
export function MethodOrder({ items }: { items: Item[] }) {
  const [list, setList] = useState(items);
  useEffect(() => {
    try {
      const last = localStorage.getItem(KEY);
      if (last && items.some((i) => i.key === last)) setList([items.find((i) => i.key === last)!, ...items.filter((i) => i.key !== last)]);
    } catch { /* storage unavailable: keep the server order */ }
  }, [items]);
  const remember = (e: React.MouseEvent<HTMLDivElement>) => {
    const b = (e.target as HTMLElement).closest('button[name="method"]') as HTMLButtonElement | null;
    if (b) try { localStorage.setItem(KEY, b.value); } catch { /* ignore */ }
  };
  return <div className="stack" onClick={remember}>{list.map((i) => <div key={i.key} data-method={i.key}>{i.node}</div>)}</div>;
}
