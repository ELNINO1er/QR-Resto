import React, { useState, useRef, useCallback } from 'react';
import { colors } from '../lib/colors';

const STATUS_COLORS = {
  free: '#5C8A4A',
  occupied: colors.gold,
  ready: colors.primary,
  payment_pending: '#C77D32',
};

const STATUS_LABELS = {
  free: 'Libre',
  occupied: 'Occupee',
  ready: 'Prete',
  payment_pending: 'A payer',
};

export default function FloorPlan({ tables, onTableClick, onLayoutChange, editable = false }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e, table) => {
    if (!editable) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    setDragging(table.number);
    setDragOffset({
      x: e.clientX - rect.left - (table.x / 100) * rect.width,
      y: e.clientY - rect.top - (table.y / 100) * rect.height,
    });
  }, [editable]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(90, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
    const y = Math.max(0, Math.min(90, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100));
    onLayoutChange(dragging, x, y);
  }, [dragging, dragOffset, onLayoutChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl border-2"
      style={{ paddingBottom: '60%', background: colors.sand, borderColor: colors.sandDark }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Legend */}
      <div className="absolute top-3 right-3 flex gap-3 z-10">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[key] }} />
            <span className="text-xs" style={{ color: colors.textLight }}>{label}</span>
          </div>
        ))}
      </div>

      {tables.map(table => (
        <button
          key={table.number}
          className="absolute flex flex-col items-center justify-center rounded-full shadow-lg transition-all hover:scale-110"
          style={{
            left: `${table.x}%`,
            top: `${table.y}%`,
            width: 56,
            height: 56,
            background: STATUS_COLORS[table.status] || STATUS_COLORS.free,
            color: 'white',
            cursor: editable ? 'grab' : 'pointer',
            border: dragging === table.number ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
            zIndex: dragging === table.number ? 50 : 1,
          }}
          onClick={() => !editable && onTableClick?.(table)}
          onMouseDown={(e) => handleMouseDown(e, table)}
        >
          <span className="font-bold text-sm">{table.number}</span>
          <span className="text-[9px] opacity-80">{table.seats}p</span>
        </button>
      ))}

      {/* Totals on hover shown via tooltip in onTableClick */}
    </div>
  );
}

export function TableDetailPanel({ table, orders, onClose, currency = 'FCFA' }) {
  if (!table) return null;

  return (
    <div className="rounded-2xl p-5 shadow-md" style={{ background: 'white' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold" style={{ color: colors.text }}>Table {table.number}</h3>
          <span className="text-sm px-2 py-0.5 rounded-full" style={{ background: STATUS_COLORS[table.status] + '20', color: STATUS_COLORS[table.status] }}>
            {STATUS_LABELS[table.status]}
          </span>
        </div>
        <button onClick={onClose} className="text-sm px-3 py-1 rounded-lg" style={{ background: colors.sand, color: colors.text }}>Fermer</button>
      </div>

      {table.total > 0 && (
        <div className="rounded-xl p-3 mb-3" style={{ background: colors.sand }}>
          <p className="text-sm" style={{ color: colors.textLight }}>Total table</p>
          <p className="text-2xl font-bold" style={{ color: colors.primary }}>{table.total.toLocaleString()} {currency}</p>
        </div>
      )}

      {orders?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium" style={{ color: colors.text }}>{orders.length} commande(s) active(s)</p>
          {orders.map(o => (
            <div key={o.id} className="rounded-lg p-3 text-sm" style={{ background: colors.sand }}>
              <div className="flex justify-between">
                <span className="font-medium">#{o.id}</span>
                <span>{o.total.toLocaleString()} {currency}</span>
              </div>
              <p className="text-xs mt-1" style={{ color: colors.textLight }}>{o.itemsSummary}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'white' }}>{o.status}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: o.paymentStatus === 'paid' ? '#5C8A4A20' : '#C77D3220', color: o.paymentStatus === 'paid' ? '#5C8A4A' : '#C77D32' }}>
                  {o.paymentStatus === 'paid' ? 'Paye' : 'Non paye'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {table.status === 'free' && <p className="text-sm" style={{ color: colors.textLight }}>Aucune commande active</p>}
    </div>
  );
}
