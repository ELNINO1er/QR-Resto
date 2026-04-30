import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { colors } from '../lib/colors';

export default function Dropdown({ value, options, onChange, placeholder = 'Selectionner', className = '', buttonStyle = {} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-11 px-4 py-3 rounded-xl border-2 flex items-center justify-between gap-3 text-left font-medium focus:outline-none"
        style={{ background: 'white', borderColor: colors.sandDark, color: colors.text, ...buttonStyle }}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown size={18} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: colors.primary }} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-[80] rounded-xl shadow-2xl overflow-hidden border" style={{ background: 'white', borderColor: colors.sandDark }}>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map(option => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className="w-full px-4 py-3 text-left transition-colors"
                  style={{ background: active ? colors.primary : 'white', color: active ? colors.cream : colors.text }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
