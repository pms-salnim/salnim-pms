import React, { useState, useMemo, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Settings2,
    Calendar as CalendarIcon,
    Lock,
    Unlock,
    Zap,
    Filter,
    Save,
    Plus,
    Info,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Tag
} from 'lucide-react';

const ROOM_DATA = [
    {
        type: 'Deluxe King Room',
        id: 'rt-deluxe',
        rooms: [
            {
                id: 'R-101',
                status: 'available',
                ratePlans: [
                    { id: 'rp-std', name: 'Standard Rate', type: 'flexible' },
                    { id: 'rp-nrf', name: 'Non-Refundable', type: 'strict' },
                    { id: 'rp-corp', name: 'Corporate Plan', type: 'hidden' }
                ]
            },
            {
                id: 'R-102',
                status: 'available',
                ratePlans: [
                    { id: 'rp-std', name: 'Standard Rate', type: 'flexible' },
                    { id: 'rp-nrf', name: 'Non-Refundable', type: 'strict' }
                ]
            }
        ]
    },
    {
        type: 'Executive Suite',
        id: 'rt-exec',
        rooms: [
            {
                id: 'R-201',
                status: 'available',
                ratePlans: [
                    { id: 'rp-std', name: 'Standard Rate', type: 'flexible' },
                    { id: 'rp-nrf', name: 'Non-Refundable', type: 'strict' }
                ]
            }
        ]
    }
];

const generateDates = (startDate, days = 14) => {
    const dates = [];
    for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        dates.push(date);
    }
    return dates;
};

const PmsInventoryGrid = () => {
    const [viewDate, setViewDate] = useState(new Date());
    const [gridData, setGridData] = useState({});
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [expandedRooms, setExpandedRooms] = useState({}); // Track which rooms show rate plans

    const dates = useMemo(() => generateDates(viewDate, 14), [viewDate]);

    useEffect(() => {
        const mock = {};
        ROOM_DATA.forEach(rt => {
            rt.rooms.forEach(room => {
                dates.forEach(d => {
                    const dateStr = d.toISOString().split('T')[0];
                    // Room availability data
                    mock[`${room.id}-${dateStr}`] = { available: room.status === 'available' };

                    // Rate plan pricing data
                    room.ratePlans.forEach(plan => {
                        const planKey = `${room.id}-${plan.id}-${dateStr}`;
                        mock[planKey] = {
                            rate: plan.type === 'strict' ? 160 : 180,
                            closed: false
                        };
                    });
                });
            });
        });
        setGridData(mock);
    }, []);

    const toggleRoom = (roomId) => {
        setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
    };

    const handleDataChange = (key, field, value) => {
        setGridData(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
    };

    const navigateDate = (days) => {
        const newDate = new Date(viewDate);
        newDate.setDate(viewDate.getDate() + days);
        setViewDate(newDate);
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-30">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-blue-600" />
                        Inventory & Rate Plans
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">Manage unit availability and multi-plan pricing</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white border rounded-lg overflow-hidden shadow-sm">
                        <button onClick={() => navigateDate(-7)} className="p-2 hover:bg-slate-50 border-r transition"><ChevronLeft className="w-4 h-4" /></button>
                        <div className="px-4 py-2 text-sm font-bold flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-blue-500" />
                            {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button onClick={() => navigateDate(7)} className="p-2 hover:bg-slate-50 border-l transition"><ChevronRight className="w-4 h-4" /></button>
                    </div>

                    <button onClick={() => setIsBulkOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition">
                        <Zap className="w-4 h-4" /> Bulk Update
                    </button>
                    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-100">
                        <Save className="w-4 h-4" /> Save
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-4 lg:p-6">
                <div className="inline-block min-w-full align-middle bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 backdrop-blur-sm">
                                <th className="sticky left-0 z-40 bg-slate-50 border-b border-r p-4 text-left w-72 min-w-[280px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Inventory / Plans</span>
                                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                                    </div>
                                </th>
                                {dates.map((date, i) => (
                                    <th key={i} className={`border-b border-r p-2 text-center min-w-[110px] ${date.getDay() === 0 || date.getDay() === 6 ? 'bg-blue-50/50' : ''}`}>
                                        <div className="text-[10px] uppercase font-bold text-slate-400">
                                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div className="text-sm font-black">
                                            {date.getDate()}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ROOM_DATA.map((rt) => (
                                <React.Fragment key={rt.id}>
                                    {/* ROOM TYPE HEADER */}
                                    <tr className="bg-slate-100/70">
                                        <td className="sticky left-0 z-30 bg-slate-100 border-b border-r p-3 px-4 font-black text-slate-700 text-sm uppercase tracking-tight">
                                            {rt.type}
                                        </td>
                                        {dates.map((_, i) => (
                                            <td key={i} className="border-b border-r bg-slate-100/30"></td>
                                        ))}
                                    </tr>

                                    {rt.rooms.map((room) => (
                                        <React.Fragment key={room.id}>
                                            {/* UNIT ROW */}
                                            <tr className="group">
                                                <td className="sticky left-0 z-30 bg-white border-b border-r p-3 pl-6 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleRoom(room.id)}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-1 hover:bg-slate-200 rounded text-slate-400">
                                                                {expandedRooms[room.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                            </div>
                                                            <span className="text-sm font-bold text-slate-700">{room.id}</span>
                                                        </div>
                                                        <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${room.status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {room.status.toUpperCase()}
                                                        </div>
                                                    </div>
                                                </td>
                                                {dates.map((date, i) => {
                                                    const dateStr = date.toISOString().split('T')[0];
                                                    const key = `${room.id}-${dateStr}`;
                                                    const cell = gridData[key] || { available: true };
                                                    return (
                                                        <td key={i} className={`border-b border-r p-0 text-center ${!cell.available ? 'bg-slate-100/80' : ''}`}>
                                                            <button
                                                                onClick={() => handleDataChange(key, 'available', !cell.available)}
                                                                className={`w-full h-full min-h-[50px] flex items-center justify-center transition ${cell.available ? 'hover:bg-blue-50' : 'hover:bg-slate-200'}`}
                                                            >
                                                                {cell.available ? (
                                                                    <span className="text-xs font-black text-emerald-600">OPEN</span>
                                                                ) : (
                                                                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>

                                            {/* RATE PLANS DROPDOWN ROWS */}
                                            {expandedRooms[room.id] && room.ratePlans.map((plan) => (
                                                <tr key={plan.id} className="bg-slate-50/40 animate-in slide-in-from-top-2 duration-200">
                                                    <td className="sticky left-0 z-20 bg-slate-50/90 backdrop-blur-sm border-b border-r p-2.5 pl-14">
                                                        <div className="flex items-center gap-2 text-slate-500">
                                                            <Tag className="w-3 h-3" />
                                                            <span className="text-[11px] font-bold uppercase tracking-tight truncate">{plan.name}</span>
                                                        </div>
                                                    </td>
                                                    {dates.map((date, i) => {
                                                        const dateStr = date.toISOString().split('T')[0];
                                                        const planKey = `${room.id}-${plan.id}-${dateStr}`;
                                                        const roomKey = `${room.id}-${dateStr}`;
                                                        const cell = gridData[planKey] || { rate: 0, closed: false };
                                                        const roomOpen = gridData[roomKey]?.available ?? true;

                                                        return (
                                                            <td key={i} className={`border-b border-r p-0 relative group ${!roomOpen || cell.closed ? 'bg-slate-100/50' : ''}`}>
                                                                <div className="flex flex-col h-full min-h-[60px]">
                                                                    <input
                                                                        type="number"
                                                                        disabled={!roomOpen}
                                                                        value={cell.rate}
                                                                        onChange={(e) => handleDataChange(planKey, 'rate', e.target.value)}
                                                                        className={`w-full text-center text-sm font-black p-3 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed ${!roomOpen || cell.closed ? 'text-slate-300' : 'text-slate-800'}`}
                                                                    />

                                                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => handleDataChange(planKey, 'closed', !cell.closed)}
                                                                            className={`p-1 rounded-md shadow-sm border bg-white ${cell.closed ? 'text-emerald-500' : 'text-rose-500'}`}
                                                                            title={cell.closed ? "Open Rate Plan" : "Close Rate Plan"}
                                                                        >
                                                                            {cell.closed ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                                                        </button>
                                                                    </div>

                                                                    {cell.closed && roomOpen && (
                                                                        <div className="absolute bottom-1 w-full text-center">
                                                                            <span className="text-[7px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase">Stop</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bulk Update Modal */}
            {isBulkOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="p-8 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                    <Zap className="w-6 h-6 text-blue-600" />
                                    Smart Bulk Manager
                                </h2>
                                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Apply changes across the property</p>
                            </div>
                            <button onClick={() => setIsBulkOpen(false)} className="bg-white p-2 rounded-full border shadow-sm hover:bg-slate-50">✕</button>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Timeline Start</label>
                                    <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Timeline End</label>
                                    <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Target Rate Plans</label>
                                <div className="flex flex-wrap gap-2">
                                    <button className="px-5 py-2.5 rounded-xl border-2 border-blue-600 text-sm font-black text-white bg-blue-600 shadow-lg shadow-blue-100">All Plans</button>
                                    <button className="px-5 py-2.5 rounded-xl border-2 border-slate-100 text-sm font-bold text-slate-500 bg-slate-50 hover:border-blue-200 transition">Standard</button>
                                    <button className="px-5 py-2.5 rounded-xl border-2 border-slate-100 text-sm font-bold text-slate-500 bg-slate-50 hover:border-blue-200 transition">Non-Refundable</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 pt-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">New Rate</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 pl-8 font-black outline-none focus:border-blue-500" placeholder="0.00" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Min. Stay</label>
                                    <input type="number" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500" placeholder="1" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Operation</label>
                                    <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none appearance-none bg-white focus:border-blue-500">
                                        <option>Set Value</option>
                                        <option>Increase %</option>
                                        <option>Decrease %</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t flex justify-end gap-4">
                            <button onClick={() => setIsBulkOpen(false)} className="px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition">Discard</button>
                            <button className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:bg-black transition transform active:scale-95">
                                Apply to Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <footer className="bg-white border-t px-6 py-3 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] shrink-0">
                <div className="flex gap-6">
                    <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm" /> Inventory Open</span>
                    <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-rose-500 shadow-sm" /> Plan Stopped</span>
                    <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-slate-200 shadow-sm" /> Unit Locked</span>
                </div>
                <div className="flex items-center gap-2">
                    <CreditCard className="w-3 h-3" /> Currency: USD ($)
                </div>
            </footer>
        </div>
    );
};

export default PmsInventoryGrid;