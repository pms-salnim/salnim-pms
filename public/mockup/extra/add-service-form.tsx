import React, { useState } from 'react';
import {
    X,
    Layers,
    Image as ImageIcon,
    DollarSign,
    Clock,
    Calendar,
    Info,
    PlusCircle,
    Trash2,
    GripVertical,
    Globe,
    Monitor,
    Layout,
    Tag,
    MapPin,
    FileText
} from 'lucide-react';

const App = () => {
    // --- STATE MANAGEMENT ---
    const [formData, setFormData] = useState({
        category: 'Excursion',
        subCategory: 'Desert Tours',
        name: '',
        shortDesc: '',
        longDesc: '',
        tags: ['Popular', 'Adventure'],
        status: 'Active',
        visibility: {
            bookingPage: true,
            guestPortal: true,
            staffOnly: false
        },
        circuit: [
            { id: 1, time: '09:00', activity: 'Hotel Pickup', location: 'Lobby' },
            { id: 2, time: '10:30', activity: 'Arrival at Dunes', location: 'Merzouga' }
        ],
        pricingModel: 'Tiered',
        variations: [
            { id: 1, label: 'Standard Package', adult: 450, child: 250, infant: 0, cost: 150 }
        ],
        inventory: {
            unlimited: false,
            dailyLimit: 20,
            minNotice: 12 // hours
        },
        images: []
    });

    const theme = {
        navy: "#003166",
        orange: "#ea580c",
        slate: "#64748b",
        border: "#e2e8f0"
    };

    // --- ACTIONS ---
    const addCircuitStep = () => {
        setFormData({
            ...formData,
            circuit: [...formData.circuit, { id: Date.now(), time: '', activity: '', location: '' }]
        });
    };

    const addVariation = () => {
        setFormData({
            ...formData,
            variations: [...formData.variations, { id: Date.now(), label: '', adult: 0, child: 0, infant: 0, cost: 0 }]
        });
    };

    const removeVariation = (id) => {
        setFormData({ ...formData, variations: formData.variations.filter(v => v.id !== id) });
    };

    return (
        <div className="min-h-screen bg-slate-900/50 p-4 md:p-12 flex justify-center items-start font-sans">
            <div className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[90vh]">

                {/* MODAL HEADER */}
                <header className="px-10 py-8 bg-[#003166] text-white flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="bg-[#ea580c] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">New Entry</span>
                            <h1 className="text-2xl font-black tracking-tight">Create Service Inventory</h1>
                        </div>
                        <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em]">PMS Extras & Ancillary Services</p>
                    </div>
                    <button className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </header>

                {/* MAIN FORM AREA */}
                <div className="flex-1 overflow-y-auto p-10 space-y-16">

                    {/* SECTION 1: CLASSIFICATION & CHANNELS */}
                    <section className="grid grid-cols-12 gap-10">
                        <div className="col-span-4 space-y-2">
                            <h3 className="text-[#003166] font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <Layers className="w-4 h-4" /> 1. Classification
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed font-medium">Define how this service is categorized in the inventory and where it appears.</p>
                        </div>

                        <div className="col-span-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Category</label>
                                    <select
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#ea580c]/20 outline-none transition-all"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option>Excursion</option>
                                        <option>Wellness & Spa</option>
                                        <option>Transfer / Logistics</option>
                                        <option>Room Amenity</option>
                                        <option>F&B Special</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub-Category</label>
                                    <input type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold" placeholder="e.g. Quad Tours" defaultValue={formData.subCategory} />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 grid grid-cols-3 gap-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${formData.visibility.bookingPage ? 'bg-[#ea580c] text-white' : 'bg-slate-200 text-slate-400'}`}>
                                        <Monitor className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-800">Booking Engine</span>
                                        <input type="checkbox" className="w-4 h-4 mt-1 accent-[#ea580c]" checked={formData.visibility.bookingPage} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${formData.visibility.guestPortal ? 'bg-[#003166] text-white' : 'bg-slate-200 text-slate-400'}`}>
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-800">Guest Portal</span>
                                        <input type="checkbox" className="w-4 h-4 mt-1 accent-[#ea580c]" checked={formData.visibility.guestPortal} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 opacity-50">
                                    <div className="p-2 rounded-lg bg-slate-200 text-slate-400">
                                        <Tag className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-800">Staff Only</span>
                                        <input type="checkbox" className="w-4 h-4 mt-1 accent-[#ea580c]" checked={formData.visibility.staffOnly} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2: CONTENT & ITINERARY */}
                    <section className="grid grid-cols-12 gap-10">
                        <div className="col-span-4 space-y-2">
                            <h3 className="text-[#003166] font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <Layout className="w-4 h-4" /> 2. Guest Facing Content
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed font-medium">The information displayed on the Booking Engine and Guest Portal cards.</p>
                        </div>

                        <div className="col-span-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Display Name</label>
                                <input type="text" className="w-full p-4 border border-slate-200 rounded-2xl text-lg font-black text-[#003166] focus:border-[#ea580c] outline-none" placeholder="e.g. Sunset Camel Trek with Berber Dinner" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Catchy Description</label>
                                <input type="text" className="w-full p-4 border border-slate-200 rounded-2xl text-sm italic" placeholder="The ultimate desert experience under the stars..." />
                            </div>

                            {/* DYNAMIC CIRCUIT PLAN FOR EXCURSIONS */}
                            {formData.category === 'Excursion' && (
                                <div className="p-8 bg-[#f8fafc] rounded-[2rem] border border-slate-200 space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-xs font-black text-[#003166] uppercase tracking-widest">Circuit Itinerary Plan</h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5">Visible as a timeline for the guest</p>
                                        </div>
                                        <button onClick={addCircuitStep} className="flex items-center gap-2 text-[10px] font-black text-[#ea580c] bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 hover:scale-105 transition-all">
                                            <PlusCircle className="w-3.5 h-3.5" /> ADD STEP
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.circuit.map((step, idx) => (
                                            <div key={step.id} className="flex gap-4 items-center bg-white p-3 rounded-2xl border border-slate-100 group">
                                                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                                                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <Clock className="w-3 h-3 text-[#ea580c]" />
                                                    <input type="time" className="bg-transparent border-none text-[11px] font-bold p-0 w-16" defaultValue={step.time} />
                                                </div>
                                                <div className="flex-1 flex gap-4">
                                                    <input type="text" className="flex-1 text-xs font-bold border-none bg-transparent p-0 placeholder:text-slate-300" placeholder="Activity (e.g. Arrival at Oasis)" defaultValue={step.activity} />
                                                    <div className="flex items-center gap-2 text-slate-400 border-l pl-4">
                                                        <MapPin className="w-3 h-3" />
                                                        <input type="text" className="text-[10px] border-none bg-transparent p-0 w-24" placeholder="Location" defaultValue={step.location} />
                                                    </div>
                                                </div>
                                                <button className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SECTION 3: PRICING MATRIX */}
                    <section className="grid grid-cols-12 gap-10">
                        <div className="col-span-4 space-y-2">
                            <h3 className="text-[#003166] font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> 3. Advanced Pricing Matrix
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed font-medium">Define price variations and guest age tiers.</p>
                        </div>

                        <div className="col-span-8 space-y-6">
                            <div className="rounded-[2rem] border border-slate-200 overflow-hidden bg-white shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Variation Label</th>
                                            <th className="px-4 py-4">Adult</th>
                                            <th className="px-4 py-4">Child</th>
                                            <th className="px-4 py-4">Infant</th>
                                            <th className="px-4 py-4">Cost/Net</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {formData.variations.map((v) => (
                                            <tr key={v.id} className="group hover:bg-slate-50/50">
                                                <td className="px-6 py-4">
                                                    <input type="text" className="w-full text-xs font-black text-[#003166] border-none bg-transparent p-0 placeholder:text-slate-200" placeholder="e.g. Private Jeep" defaultValue={v.label} />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input type="number" className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-center" defaultValue={v.adult} />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input type="number" className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-center" defaultValue={v.child} />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input type="number" className="w-16 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-center" defaultValue={v.infant} />
                                                </td>
                                                <td className="px-4 py-4 opacity-50">
                                                    <input type="number" className="w-16 p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-center italic" defaultValue={v.cost} />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => removeVariation(v.id)} className="p-2 text-slate-200 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button
                                    onClick={addVariation}
                                    className="w-full py-4 bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:bg-[#ea580c] hover:text-white transition-all border-t border-slate-200"
                                >
                                    + Add Price Variation (e.g. Premium / VIP)
                                </button>
                            </div>

                            <div className="flex gap-4 p-5 bg-orange-50 rounded-[1.5rem] border border-orange-100">
                                <Info className="w-5 h-5 text-[#ea580c] shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-[11px] font-black text-[#ea580c] uppercase tracking-widest mb-1">Pricing Tip</h5>
                                    <p className="text-[11px] text-[#ea580c]/80 font-medium leading-relaxed">
                                        Setting "Infant" to 0 will mark it as free for children under 4. Ensure you define "Adult" as the base price.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 4: LOGISTICS & INVENTORY */}
                    <section className="grid grid-cols-12 gap-10 pb-20">
                        <div className="col-span-4 space-y-2">
                            <h3 className="text-[#003166] font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> 4. Logistics & Limits
                            </h3>
                            <p className="text-slate-400 text-xs leading-relaxed font-medium">Control capacity and booking windows.</p>
                        </div>

                        <div className="col-span-8 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Capacity</label>
                                        <span className="text-[10px] font-bold text-[#ea580c]">{formData.inventory.dailyLimit} Pax</span>
                                    </div>
                                    <input
                                        type="range"
                                        className="w-full accent-[#ea580c]"
                                        min="1" max="100"
                                        value={formData.inventory.dailyLimit}
                                        onChange={(e) => setFormData({ ...formData, inventory: { ...formData.inventory, dailyLimit: e.target.value } })}
                                    />
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" className="w-4 h-4 accent-[#ea580c]" />
                                        <span className="text-xs font-bold text-slate-500">Unlimited Capacity</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cut-off Time (Hrs)</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-3.5 w-4 h-4 text-slate-300" />
                                        <input type="number" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" defaultValue={formData.inventory.minNotice} />
                                        <span className="absolute right-4 top-4 text-[9px] font-black text-slate-400 uppercase">Hours notice</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* STICKY FOOTER */}
                <footer className="px-10 py-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                    <button className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                        Discard Entry
                    </button>
                    <div className="flex gap-4">
                        <button className="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-600 uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all">
                            Save as Draft
                        </button>
                        <button className="px-10 py-4 bg-[#ea580c] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all">
                            Publish Service
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default App;