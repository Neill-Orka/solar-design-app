import React, { useEffect, useState, useMemo } from 'react';
import { listProducts } from '../api';
import type { Product } from '../types';

type Picked = { product: Product; qty: number };

type Props = {
    open: boolean;
    onClose: () => void;
    onAdd: (items: Picked[]) => void;
    initialCategory?: string;
};

export default function ProductPickerModal({ open, onClose, onAdd, initialCategory }: Props) {
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<Product[]>([]);
    const [sel, setSel] = useState<Record<number, number>>({});

    // debounce search
    const [debouncedQ, setDebouncedQ] = useState(q);
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q), 250);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        listProducts({ q: debouncedQ || undefined, category: initialCategory, limit: 50 })
            .then(setRows)
            .finally(() => setLoading(false));
    }, [open, debouncedQ, initialCategory]);

    const picked = useMemo<Picked[]>(
        () => 
            Object.entries(sel)
                .filter(([_, qty]) => Number(qty) > 0)
                .map(([id, qty]) => {
                    const p = rows.find(r => r.id === Number(id));
                    return p ? { product: p, qty: Number(qty) } : null;
                })
                .filter(Boolean) as Picked[],
        [sel, rows]
    );

    const toggle = (id: number) => 
        setSel(s => ({ ...s, [id]: s[id] ? 0 : 1}))

    const setQty = (id: number, qty: number) =>
        setSel(s => ({ ...s, [id]: Math.max(0, Math.min(9999, qty || 0)) }));

    if (!open) return null;

    return (
        <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: "rgba(0,0,0,0.45)" }}>
        <div className="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down">
            <div className="modal-content">
            <div className="modal-header">
                <h5 className="modal-title">Add Materials</h5>
                <button className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
                <div className="input-group mb-3">
                <span className="input-group-text">Search</span>
                <input className="form-control" placeholder="Brand, model, category…" value={q} onChange={e => setQ(e.target.value)} />
                </div>

                {loading ? (
                <div className="text-muted">Loading…</div>
                ) : rows.length === 0 ? (
                <div className="text-muted">No products found.</div>
                ) : (
                <div className="list-group">
                    {rows.map(p => {
                    const checked = (sel[p.id] || 0) > 0;
                    const price = p.price ?? p.unit_cost ?? 0;
                    return (
                        <label key={p.id} className="list-group-item d-flex align-items-center justify-content-between gap-2">
                        <div className="d-flex flex-column">
                            <div className="fw-semibold">
                            {p.brand || ""} {p.model ? `${p.model}` : ""}
                            </div>
                            <small className="text-muted">
                            {p.category || "Uncategorised"} {p.component_type ? `• ${p.component_type}` : ""}
                            </small>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <div className="text-nowrap small text-muted">R {Number(price).toFixed(2)}</div>
                            <input
                            type="number"
                            className="form-control form-control-sm"
                            style={{ width: 72 }}
                            min={0}
                            value={sel[p.id] || 0}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setQty(p.id, Number(e.target.value))}
                            />
                            <input
                            type="checkbox"
                            className="form-check-input"
                            checked={checked}
                            onChange={() => toggle(p.id)}
                            aria-label="Select"
                            />
                        </div>
                        </label>
                    );
                    })}
                </div>
                )}
            </div>

            <div className="modal-footer">
                <div className="me-auto small text-muted">
                {picked.length} selected
                </div>
                <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
                <button
                className="btn btn-primary"
                onClick={() => { onAdd(picked); onClose(); }}
                disabled={picked.length === 0}
                >
                Add to Job
                </button>
            </div>
            </div>
        </div>
        </div>
    );
}