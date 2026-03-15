import React, { useState, useMemo } from 'react';
import {
    User,
    Plus,
    Trash2,
    Check,
    CreditCard,
    ArrowRight,
    Info,
    Calendar,
    Box,
    Utensils,
    MapPin,
    Mail,
    Phone,
    LayoutGrid,
    ChevronDown,
    Globe,
    Tag,
    ChevronUp,
    X,
    Wallet
} from 'lucide-react';

const App = () => {
    // Brand Configuration
    const THEME_COLOR = '#003166';
    const BORDER_RADIUS = 'rounded-md';

    // --- MOCK DATA ---
    const roomTypes = [
        { id: 'std', name: 'Standard Executive Room', basePrice: 145 },
        { id: 'dlx', name: 'Deluxe Business Suite', basePrice: 280 },
        { id: 'pen', name: 'Presidential Wing', basePrice: 550 },
    ];

    const ratePlans = [
        { id: 'flex', name: 'Best Available Rate', discount: 0 },
        { id: 'nrf', name: 'Non-Refundable Early Bird', discount: 0.15 },
        { id: 'corp', name: 'Corporate Account Rate', discount: 0.10 }
    ];

    const extraCategories = [
        {
            label: 'Services',
            icon: <Box size={16} style={{ color: THEME_COLOR }} />,
            items: [
                { id: 'wd1', name: 'Whine Dune 4x4 Expedition (Copy)', price: 120 },
                { id: 'wd2', name: 'Whine Dune 4x4 Safari', price: 95 },
                { id: 'wd3', name: 'Whine Dune 4x4 Expedition', price: 110 }
            ]
        },
        {
            label: 'Meal Plans',
            icon: <Utensils size={16} style={{ color: THEME_COLOR }} />,
            items: [
                { id: 'brk', name: 'Breakfast Included', price: 25 }
            ]
        }
    ];

    // --- STATE ---
    const [guest, setGuest] = useState({ name: '', phone: '', email: '', country: '', identity: '' });
    const [dates, setDates] = useState({ start: '', end: '' });
    const [source, setSource] = useState('Direct');
    const [resStatus, setResStatus] = useState('pending');
    const [payStatus, setPayStatus] = useState('pending');
    const [payMethod, setPayMethod] = useState('Cash');
    const [rooms, setRooms] = useState([]);

    // Current active room form state
    const [currentRoom, setCurrentRoom] = useState({
        typeId: 'std',
        specificRoom: '',
        adults: 1,
        children: 0,
        pricingMode: 'rate-plan',
        planId: 'flex',
        manualPrice: 0,
        extras: []
    });

    const [coupon, setCoupon] = useState('');
    const [promotion, setPromotion] = useState('none');

    // --- ACTIONS ---
    const handleAddRoom = () => {
        const typeObj = roomTypes.find(t => t.id === currentRoom.typeId);
        const planObj = ratePlans.find(p => p.id === currentRoom.planId);

        const pricePerNight = currentRoom.pricingMode === 'manual'
            ? Number(currentRoom.manualPrice)
            : typeObj.basePrice * (1 - planObj.discount);

        setRooms([...rooms, {
            ...currentRoom,
            id: Date.now(),
            displayName: typeObj.name,
            calculatedPrice: pricePerNight
        }]);

        // Reset current room form
        setCurrentRoom({
            typeId: 'std',
            specificRoom: '',
            adults: 1,
            children: 0,
            pricingMode: 'rate-plan',
            planId: 'flex',
            manualPrice: 0,
            extras: []
        });
    };

    const removeRoom = (id) => setRooms(rooms.filter(r => r.id !== id));

    const toggleExtra = (itemId) => {
        setCurrentRoom(prev => ({
            ...prev,
            extras: prev.extras.includes(itemId)
                ? prev.extras.filter(id => id !== itemId)
                : [...prev.extras, itemId]
        }));
    };

    // --- TOTALS ---
    const summary = useMemo(() => {
        const roomsTotal = rooms.reduce((acc, r) => acc + r.calculatedPrice, 0);
        let extrasTotal = 0;

        rooms.forEach(room => {
            room.extras.forEach(extraId => {
                extraCategories.forEach(cat => {
                    const item = cat.items.find(i => i.id === extraId);
                    if (item) extrasTotal += item.price;
                });
            });
        });

        const subtotal = roomsTotal + extrasTotal;
        const promoDiscount = promotion === 'WELCOME10' ? subtotal * 0.1 : 0;
        const taxableAmount = subtotal - promoDiscount;
        const tax = taxableAmount * 0.12;
        const grandTotal = taxableAmount + tax;

        return { roomsTotal, extrasTotal, subtotal, tax, grandTotal, promoDiscount };
    }, [rooms, promotion]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: FORM */}
                <div className="lg:col-span-8 space-y-6">

                    {/* 1. GUEST DETAILS */}
                    <section className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm overflow-hidden`}>
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                            <User size={18} style={{ color: THEME_COLOR }} />
                            <h2 className="font-bold text-slate-700">Guest Details</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Full Name</label>
                                <input type="text" className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} placeholder="Guest full name" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Email Address</label>
                                <input type="email" className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} placeholder="email@address.com" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Phone Number</label>
                                <input type="text" className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} placeholder="+1..." />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Country</label>
                                <input type="text" className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} placeholder="Country" />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-500">Passport / ID Number</label>
                                <input type="text" className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`} placeholder="Identification Details" />
                            </div>
                        </div>
                    </section>

                    {/* 2. DATES & SOURCE */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar size={18} style={{ color: THEME_COLOR }} />
                                <h2 className="font-bold text-slate-700">Booking Dates</h2>
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Check-in</label>
                                    <input type="date" className="w-full p-2 border-b border-slate-200 outline-none text-sm font-medium" />
                                </div>
                                <ArrowRight size={14} className="text-slate-300 mt-4" />
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Check-out</label>
                                    <input type="date" className="w-full p-2 border-b border-slate-200 outline-none text-sm font-medium" />
                                </div>
                            </div>
                        </div>

                        <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
                            <div className="flex items-center gap-2 mb-4">
                                <MapPin size={18} style={{ color: THEME_COLOR }} />
                                <h2 className="font-bold text-slate-700">Booking Source</h2>
                            </div>
                            <div className="flex gap-4 mt-2">
                                {['Direct', 'Walk-in', 'OTA'].map(s => (
                                    <label key={s} className="flex items-center gap-2 cursor-pointer group">
                                        <div
                                            onClick={() => setSource(s)}
                                            className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-all ${source === s ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}
                                        >
                                            {source === s && <Check size={14} className="text-white" />}
                                        </div>
                                        <span className="text-sm font-medium text-slate-600">{s}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* 3. ROOM SELECTION (MULTI-ROOM) */}
                    <section className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm overflow-hidden`}>
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LayoutGrid size={18} style={{ color: THEME_COLOR }} />
                                <h2 className="font-bold text-slate-700">Room Selection</h2>
                            </div>
                            <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">{rooms.length} Rooms added</span>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Saved Rooms (Collapsed List) */}
                            {rooms.map((room, idx) => (
                                <div key={room.id} className={`flex items-center justify-between p-4 bg-slate-50 border border-slate-100 ${BORDER_RADIUS}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: THEME_COLOR }}>#{idx + 1}</span>
                                            <h3 className="font-bold text-sm">{room.displayName}</h3>
                                            <span className="text-xs text-slate-400 ml-2">• Room: {room.specificRoom || 'Auto-assign'}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                                            {room.adults} Adults, {room.children} Children • {room.planId} • {room.extras.length} Extras
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-sm">${room.calculatedPrice.toFixed(2)}</span>
                                        <button onClick={() => removeRoom(room.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Active Room Adder */}
                            <div className={`border-2 border-dashed border-slate-200 p-6 ${BORDER_RADIUS} space-y-6 bg-slate-50/40 mt-4`}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Room Type</label>
                                        <select
                                            className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`}
                                            value={currentRoom.typeId}
                                            onChange={e => setCurrentRoom({ ...currentRoom, typeId: e.target.value })}
                                        >
                                            {roomTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Specific Room #</label>
                                        <input
                                            type="text"
                                            className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none focus:border-slate-400`}
                                            placeholder="e.g. 102 (Optional)"
                                            value={currentRoom.specificRoom}
                                            onChange={e => setCurrentRoom({ ...currentRoom, specificRoom: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Adults</label>
                                            <input type="number" className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`} value={currentRoom.adults} onChange={e => setCurrentRoom({ ...currentRoom, adults: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Children</label>
                                            <input type="number" className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`} value={currentRoom.children} onChange={e => setCurrentRoom({ ...currentRoom, children: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Pricing Mode</label>
                                        <div className="flex bg-slate-100 p-1 rounded-md">
                                            {['rate-plan', 'manual'].map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setCurrentRoom({ ...currentRoom, pricingMode: m })}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase transition-all ${currentRoom.pricingMode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {m.replace('-', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {currentRoom.pricingMode === 'rate-plan' ? (
                                            <>
                                                <label className="text-xs font-bold text-slate-400 uppercase">Rate Plan</label>
                                                <select
                                                    className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                                                    value={currentRoom.planId}
                                                    onChange={e => setCurrentRoom({ ...currentRoom, planId: e.target.value })}
                                                >
                                                    {ratePlans.map(p => <option key={p.id} value={p.id}>{p.name} (-{p.discount * 100}%)</option>)}
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label className="text-xs font-bold text-slate-400 uppercase">Manual Price ($)</label>
                                                <input
                                                    type="number"
                                                    className={`w-full p-2 bg-white border border-slate-200 ${BORDER_RADIUS} text-sm outline-none`}
                                                    value={currentRoom.manualPrice}
                                                    onChange={e => setCurrentRoom({ ...currentRoom, manualPrice: e.target.value })}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* EXTRAS (REPLICATED SCREENSHOT DESIGN) */}
                                <div className="pt-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Box size={18} style={{ color: THEME_COLOR }} />
                                        <h3 className="text-sm font-bold text-slate-800">Extras & Add-ons</h3>
                                    </div>

                                    {extraCategories.map((cat, idx) => (
                                        <div key={idx} className="mb-6 last:mb-0">
                                            <div className="flex items-center gap-2 mb-3">
                                                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{cat.label}</h4>
                                            </div>
                                            <div className="space-y-2">
                                                {cat.items.map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => toggleExtra(item.id)}
                                                        className={`flex items-center justify-between p-3.5 bg-white border border-slate-200 ${BORDER_RADIUS} cursor-pointer hover:bg-slate-50 transition-all select-none group`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${currentRoom.extras.includes(item.id) ? 'bg-[#003166] border-[#003166]' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                                                                {currentRoom.extras.includes(item.id) && <Check size={14} className="text-white" />}
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-300">+${item.price}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleAddRoom}
                                    className={`w-full py-4 mt-6 text-white font-bold text-xs uppercase tracking-widest shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${BORDER_RADIUS}`}
                                    style={{ backgroundColor: THEME_COLOR }}
                                >
                                    <Plus size={16} /> Save & Add Room
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* 4. STATUS & PAYMENT METHOD */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
                            <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Reservation Status</h2>
                            <div className="flex flex-wrap gap-2">
                                {['pending', 'confirmed', 'Canceled', 'No-show'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setResStatus(s)}
                                        className={`px-3 py-2 text-[10px] font-bold uppercase rounded-md border transition-all ${resStatus === s ? 'text-white border-transparent' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                        style={{ backgroundColor: resStatus === s ? THEME_COLOR : '' }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6`}>
                            <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Payment Status</h2>
                            <div className="flex flex-wrap gap-2">
                                {['pending', 'partial', 'paid', 'Refunded'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setPayStatus(s)}
                                        className={`px-3 py-2 text-[10px] font-bold uppercase rounded-md border transition-all ${payStatus === s ? 'text-white border-transparent' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                        style={{ backgroundColor: payStatus === s ? THEME_COLOR : '' }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-sm p-6 md:col-span-2`}>
                            <div className="flex items-center gap-2 mb-4">
                                <Wallet size={16} style={{ color: THEME_COLOR }} />
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payment Method</h2>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {['Cash', 'Credit Card', 'Check', 'Bank Transfer'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setPayMethod(m)}
                                        className={`flex-1 min-w-[120px] p-3 text-xs font-bold uppercase rounded-md border text-center transition-all ${payMethod === m ? 'border-transparent text-white shadow-md shadow-slate-200' : 'border-slate-200 text-slate-400 bg-white hover:border-slate-300'}`}
                                        style={{ backgroundColor: payMethod === m ? THEME_COLOR : '' }}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                </div>

                {/* RIGHT COLUMN: BOOKING SUMMARY (FIXED ON RIGHT) */}
                <div className="lg:col-span-4 relative">
                    <aside className={`bg-white ${BORDER_RADIUS} border border-slate-200 shadow-xl overflow-hidden sticky top-8`}>
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between" style={{ backgroundColor: `${THEME_COLOR}05` }}>
                            <h2 className="font-bold text-slate-800">Booking Summary</h2>
                            <CreditCard size={18} style={{ color: THEME_COLOR }} />
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Rooms Total</span>
                                    <span className="font-bold text-slate-800">${summary.roomsTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Extras Total</span>
                                    <span className="font-bold text-slate-800">${summary.extrasTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
                                    <span className="font-bold text-slate-800">Subtotal</span>
                                    <span className="font-bold text-slate-800">${summary.subtotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* PROMO SECTION */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coupon Code</label>
                                    <div className={`flex bg-slate-50 border border-slate-200 ${BORDER_RADIUS} overflow-hidden`}>
                                        <input
                                            type="text"
                                            value={coupon}
                                            onChange={e => setCoupon(e.target.value)}
                                            placeholder="ENTER CODE"
                                            className="bg-transparent flex-1 px-3 py-2 text-xs font-bold outline-none uppercase placeholder:text-slate-300"
                                        />
                                        <button className="px-4 bg-slate-200 text-slate-600 text-[10px] font-bold hover:bg-slate-300 transition-colors">APPLY</button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-applied Promotions</label>
                                    <select
                                        value={promotion}
                                        onChange={e => setPromotion(e.target.value)}
                                        className={`w-full p-2.5 bg-slate-50 border border-slate-200 ${BORDER_RADIUS} text-xs font-medium outline-none text-slate-600`}
                                    >
                                        <option value="none">No promotion applied</option>
                                        <option value="WELCOME10">Welcome Back Discount (10%)</option>
                                        <option value="SEASONAL">Seasonal Off-Peak (5%)</option>
                                    </select>
                                </div>
                            </div>

                            {/* FINAL TOTALS */}
                            <div className="space-y-3 pt-6 border-t border-slate-100">
                                {summary.promoDiscount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                                            <Tag size={12} /> Discount
                                        </span>
                                        <span className="text-emerald-600 font-bold">-${summary.promoDiscount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Tax & Levies (12%)</span>
                                    <span className="font-bold text-slate-800">${summary.tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-end pt-2">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Grand Total</span>
                                    <span className="text-4xl font-black tracking-tighter" style={{ color: THEME_COLOR }}>
                                        ${summary.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-6">
                                <button
                                    className={`w-full py-4 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/10 active:scale-[0.98] transition-all ${BORDER_RADIUS}`}
                                    style={{ backgroundColor: THEME_COLOR }}
                                >
                                    Confirm Reservation
                                </button>
                                <div className="flex items-center justify-center gap-2 py-4">
                                    <Info size={14} className="text-slate-300" />
                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Prices exclude local tourism fee</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

            </div>
        </div>
    );
};

export default App;