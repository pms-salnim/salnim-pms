import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Calendar as CalendarIcon,
    CheckCircle2,
    XCircle,
    Settings2,
    Save,
    X,
    Check
} from 'lucide-react';

/**
 * MOCK DATA GENERATION
 */
const ROOM_TYPES = [
    { id: 'dlx', name: 'Deluxe Room', units: 3, basePrice: 1500 },
    { id: 'std', name: 'Standard Room', units: 5, basePrice: 850 },
    { id: 'ste', name: 'Executive Suite', units: 2, basePrice: 2400 },
];

const generateDates = (days = 21) => {
    const dates = [];
    const start = new Date();
    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
    }
    return dates;
};

const DATES = generateDates(21);

const App = () => {
    // --- STATE ---
    const [expandedRows, setExpandedRows] = useState({});
    const [viewMode, setViewMode] = useState('inventory');
    const [gridData, setGridData] = useState({});
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [editingCell, setEditingCell] = useState(null);

    const gridRef = useRef(null);

    // --- INITIALIZATION ---
    useEffect(() => {
        const initialData = {};
        ROOM_TYPES.forEach(rt => {
            DATES.forEach(date => {
                const dateKey = date.toISOString().split('T')[0];
                const key = `${rt.id}-${dateKey}`;

                // Parent Level Data
                initialData[key] = {
                    price: rt.basePrice,
                    status: 'available', // Defaults to available but won't be displayed
                    minStay: Math.random() > 0.7 ? 2 : 1,
                    maxStay: 0,
                    cta: false,
                    ctd: false,
                    isOverride: false
                };

                // Individual Room Level Data
                for (let i = 1; i <= rt.units; i++) {
                    const roomKey = `${rt.id}-${i}-${dateKey}`;
                    initialData[roomKey] = {
                        status: Math.random() > 0.95 ? 'stop-sell' : 'available'
                    };
                }
            });
        });
        setGridData(initialData);
    }, []);

    // --- HANDLERS ---
    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getCellData = (rowId, date) => {
        const dateKey = date.toISOString().split('T')[0];
        const key = `${rowId}-${dateKey}`;
        return gridData[key] || { price: 0, status: 'available', minStay: 1 };
    };

    const handleMouseDown = (id, date) => {
        const key = `${id}|${date.toISOString().split('T')[0]}`;
        setIsDragging(true);
        setSelectedCells(new Set([key]));
    };

    const handleMouseEnter = (id, date) => {
        if (!isDragging) return;
        const key = `${id}|${date.toISOString().split('T')[0]}`;
        setSelectedCells(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const openEditor = (id, date, data, isRoomLevel) => {
        setEditingCell({ id, date, data, dateKey: date.toISOString().split('T')[0], isRoomLevel });
    };

    const saveCellEdit = (newData) => {
        const key = `${editingCell.id}-${editingCell.dateKey}`;
        setGridData(prev => ({
            ...prev,
            [key]: { ...prev[key], ...newData, isOverride: !editingCell.isRoomLevel }
        }));
        setEditingCell(null);
    };

    // --- COMPONENTS ---

    const Cell = ({ rowId, date, isRoomLevel = false }) => {
        const data = getCellData(rowId, date);
        const dateKey = date.toISOString().split('T')[0];
        const selectionKey = `${rowId}|${dateKey}`;
        const isSelected = selectedCells.has(selectionKey);

        // Render for Individual Rooms (Simplified: Icon only)
        if (isRoomLevel) {
            return (
                <div
                    onMouseDown={() => handleMouseDown(rowId, date)}
                    onMouseEnter={() => handleMouseEnter(rowId, date)}
                    onClick={(e) => { if (e.detail === 2) openEditor(rowId, date, data, true); }}
                    className={`
            relative min-w-[160px] h-[70px] border-r border-b flex items-center justify-center transition-all cursor-pointer select-none
            ${isSelected ? 'bg-blue-50/50 ring-2 ring-blue-400 ring-inset z-10' : 'bg-slate-50/20 hover:bg-slate-100'}
          `}
                >
                    {data.status === 'available' ? (
                        <div className="flex flex-col items-center gap-0.5 opacity-60">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <Check size={12} strokeWidth={3} />
                            </div>
                            <span className="text-[8px] font-bold text-emerald-600 uppercase">Available</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-0.5">
                            <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                                <X size={12} strokeWidth={3} />
                            </div>
                            <span className="text-[8px] font-bold text-rose-600 uppercase tracking-tight">Stop Sell</span>
                        </div>
                    )}
                </div>
            );
        }

        // Render for Room Types (Full Details, No Availability Status)
        return (
            <div
                onMouseDown={() => handleMouseDown(rowId, date)}
                onMouseEnter={() => handleMouseEnter(rowId, date)}
                onClick={(e) => { if (e.detail === 2) openEditor(rowId, date, data, false); }}
                className={`
          relative min-w-[160px] h-[90px] border-r border-b p-2.5 transition-all cursor-pointer select-none
          ${isSelected ? 'bg-blue-50/50 ring-2 ring-blue-400 ring-inset z-10' : 'bg-white hover:bg-slate-50'}
        `}
            >
                <div className="mb-1.5">
                    <span className={`text-[15px] font-bold leading-none ${data.isOverride ? 'text-blue-600' : 'text-slate-800'}`}>
                        €{data.price.toLocaleString()}
                    </span>
                </div>

                <div className="flex flex-col gap-1 mt-auto">
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-medium whitespace-nowrap">
                            Min {data.minStay} night
                        </span>
                        {data.cta && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200 font-bold">CTA</span>}
                        {data.ctd && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200 font-bold">CTD</span>}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden" onMouseUp={handleMouseUp}>
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm z-30">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold text-slate-800">PMS Calendar</h1>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg ml-4">
                        <button
                            onClick={() => setViewMode('inventory')}
                            className={`px-3 py-1 text-[12px] font-bold rounded-md transition-all ${viewMode === 'inventory' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Inventory
                        </button>
                        <button
                            onClick={() => setViewMode('room')}
                            className={`px-3 py-1 text-[12px] font-bold rounded-md transition-all ${viewMode === 'room' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Rooms
                        </button>
                    </div>
                </div>

                {selectedCells.size > 0 && (
                    <button
                        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                        onClick={() => {
                            const [rowId, dateKey] = Array.from(selectedCells)[0].split('|');
                            openEditor(rowId, new Date(dateKey), getCellData(rowId, new Date(dateKey)), rowId.includes('-'));
                        }}
                    >
                        Bulk Action ({selectedCells.size})
                    </button>
                )}
            </header>

            <div className="flex-1 overflow-auto relative" ref={gridRef}>
                <table className="border-collapse table-fixed min-w-max">
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-white border-b">
                            <th className="sticky left-0 z-30 min-w-[240px] bg-white border-r p-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Property Assets
                            </th>
                            {DATES.map((date, idx) => (
                                <th key={idx} className="min-w-[160px] p-2 text-center border-r border-b bg-white">
                                    <div className="text-[10px] font-medium text-slate-400 uppercase leading-none mb-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                    <div className="text-[14px] font-bold text-slate-800 leading-none">{date.getDate()} {date.toLocaleDateString('en-US', { month: 'short' })}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {ROOM_TYPES.map(rt => (
                            <React.Fragment key={rt.id}>
                                <tr className="group">
                                    <td className="sticky left-0 z-10 bg-white border-r border-b p-3 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleRow(rt.id)} className="p-0.5 hover:bg-slate-100 rounded">
                                                {expandedRows[rt.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm leading-tight">{rt.name}</div>
                                                <div className="text-[10px] text-slate-400 font-semibold">{rt.units} Units</div>
                                            </div>
                                        </div>
                                    </td>
                                    {DATES.map((date, idx) => (
                                        <td key={idx} className="p-0 border-b">
                                            <Cell rowId={rt.id} date={date} isRoomLevel={false} />
                                        </td>
                                    ))}
                                </tr>

                                {expandedRows[rt.id] && Array.from({ length: rt.units }).map((_, i) => (
                                    <tr key={`${rt.id}-room-${i}`} className="bg-slate-50/50">
                                        <td className="sticky left-0 z-10 bg-slate-50 border-r border-b pl-10 pr-3 py-2 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-600 leading-none">Room {101 + i + (rt.id === 'std' ? 10 : rt.id === 'ste' ? 20 : 0)}</span>
                                                <span className="text-[8px] uppercase text-slate-400 font-bold tracking-tight mt-1">Standard</span>
                                            </div>
                                        </td>
                                        {DATES.map((date, idx) => (
                                            <td key={idx} className="p-0 border-b">
                                                <Cell rowId={`${rt.id}-${i + 1}`} date={date} isRoomLevel={true} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingCell && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-150">
                        <div className="p-5 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-md font-bold text-slate-800">Quick Edit</h3>
                                <p className="text-[11px] text-slate-500 font-medium uppercase">{editingCell.date.toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                            </div>
                            <button onClick={() => setEditingCell(null)} className="p-1.5 hover:bg-slate-100 rounded-full"><X size={18} /></button>
                        </div>

                        <div className="p-5 space-y-4">
                            {!editingCell.isRoomLevel && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rate (EUR)</label>
                                    <div className="relative">
                                        <input type="number" defaultValue={editingCell.data.price} id="edit-p" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-md font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inventory Status</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setEditingCell(prev => ({ ...prev, data: { ...prev.data, status: 'available' } }))}
                                        className={`py-2 px-3 rounded-lg border-2 flex items-center justify-center gap-2 text-xs font-bold transition-all ${editingCell.data.status === 'available' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}
                                    >
                                        <CheckCircle2 size={14} /> Available
                                    </button>
                                    <button
                                        onClick={() => setEditingCell(prev => ({ ...prev, data: { ...prev.data, status: 'stop-sell' } }))}
                                        className={`py-2 px-3 rounded-lg border-2 flex items-center justify-center gap-2 text-xs font-bold transition-all ${editingCell.data.status === 'stop-sell' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white border-slate-100 text-slate-400'}`}
                                    >
                                        <XCircle size={14} /> Stop Sell
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-slate-50 flex gap-2">
                            <button onClick={() => setEditingCell(null)} className="flex-1 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                            <button
                                onClick={() => {
                                    const priceInput = document.getElementById('edit-p');
                                    saveCellEdit({
                                        ...editingCell.data,
                                        price: priceInput ? parseFloat(priceInput.value) : undefined
                                    });
                                }}
                                className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-blue-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;