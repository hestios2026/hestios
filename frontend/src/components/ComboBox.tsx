import { useState, useRef, useEffect, CSSProperties } from 'react';

interface ComboBoxProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  style?: CSSProperties;
  required?: boolean;
  inputStyle?: CSSProperties;
}

const BASE_INPUT: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

export function ComboBox({ value, onChange, suggestions, placeholder, style, required, inputStyle }: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;
  const visible = filtered.slice(0, 12);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{ ...BASE_INPUT, ...inputStyle }}
      />
      {open && visible.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
        }}>
          {visible.map(s => (
            <div
              key={s}
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
              style={{
                padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                borderBottom: '1px solid #f8fafc', color: '#1e293b',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = '#f0f9ff')}
              onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = '')}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
