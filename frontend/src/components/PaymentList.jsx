import { Link } from 'react-router-dom';
import { StatusBadge } from './Badge.jsx';
import DemoBadge from './DemoBadge.jsx';
import useFormat from '../hooks/useFormat.js';

/** Compact list of payments; each row links to its detail page. */
export default function PaymentList({ items }) {
  const fmt = useFormat();
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((p) => (
        <li key={p.id}>
          <Link to={`/app/payments/${p.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-ink-50/60">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">{p.customer_name}</p>
              <p className="truncate text-xs text-ink-500">{p.description} · {fmt.date(p.created_at)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold text-ink-900">{fmt.money(p.amount, p.currency)}</span>
              <span className="flex items-center gap-1"><StatusBadge status={p.status} />{p.is_demo && <DemoBadge />}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
