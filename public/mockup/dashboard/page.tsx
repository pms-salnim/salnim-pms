import React, { useState } from 'react';
import {
    Hotel,
    Search,
    Bell,
    Calendar,
    Users,
    TrendingUp,
    UserPlus,
    UserMinus,
    Home,
    XCircle,
    Brush,
    History,
    CheckCircle2,
    Clock,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    Star,
    MessageSquare,
    Crown,
    PieChart,
    DollarSign
} from 'lucide-react';

const BRAND_COLOR = '#003166';

const MetricCard = ({ title, value, subtext, icon: Icon, colorClass, trend }) => (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${colorClass} transition-transform hover:-translate-y-1`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{value}</h3>
            </div>
            <div className={`p-2 rounded-lg bg-slate-50`}>
                <Icon size={18} className="text-slate-400" />
            </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
            {trend ? (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center">
                    <TrendingUp size={10} className="mr-1" /> {trend}
                </span>
            ) : (
                <span className="text-[10px] text-slate-400 font-medium">{subtext}</span>
            )}
        </div>
    </div>
);

const App = () => {
    const [activeTab, setActiveTab] = useState('checkins');
    const [guestCount, setGuestCount] = useState('2 Adults, 0 Children');

    const checkins = [
        { id: 'RES-99021', name: 'Alexander Wright', roomType: 'Deluxe Sea View', nights: 3, status: 'Expected', statusColor: 'bg-blue-100 text-blue-700' },
        { id: 'RES-99044', name: 'Elena Rodriguez', roomType: 'Executive Suite', nights: 5, status: 'Arrived', statusColor: 'bg-emerald-100 text-emerald-700' },
        { id: 'RES-99055', name: 'Marco Polo', roomType: 'Standard Twin', nights: 1, status: 'Pending Paperwork', statusColor: 'bg-orange-100 text-orange-700' },
    ];

    const checkouts = [
        { id: 'RES-98772', name: 'Sarah Jenkins', room: '204', balance: '$142.00', status: 'Pending Billing', statusColor: 'bg-amber-100 text-amber-700' },
    ];

    const recentReservations = [
        { name: 'Linda Thompson', room: 'Superior Room', nights: 2, price: '$450', time: '2 mins ago' },
        { name: 'Kevin Heart', room: 'King Suite', nights: 1, price: '$299', time: '14 mins ago' },
        { name: 'Sam Wilson', room: 'Family Penthouse', nights: 4, price: '$1,840', time: '1h ago' },
    ];

    const vips = [
        { name: 'Dr. Julian Vane', tier: 'Diamond', eta: '14:30', preference: 'High floor, feather-free' },
        { name: 'Ambassador K. Singh', tier: 'Black Label', eta: '16:00', preference: 'Security escort, quiet zone' },
    ];

    const guestRequests = [
        { room: '204', request: 'Extra towels', time: '3m ago', urgency: 'high' },
        { room: '112', request: 'Wake-up call 07:00', time: '12m ago', urgency: 'low' },
        { room: '305', request: 'Ice bucket', time: '15m ago', urgency: 'medium' },
    ];

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-10">
            {/* Navigation */}
            <header style={{ backgroundColor: BRAND_COLOR }} className="text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg">
                        <Hotel size={24} style={{ color: BRAND_COLOR }} />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Grand Horizon Portal</h1>
                </div>

                <div className="flex items-center gap-6">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-2.5 text-white/60" size={16} />
                        <input
                            type="text"
                            placeholder="Global search..."
                            className="bg-white/10 border border-white/20 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 transition-all w-64"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative cursor-pointer hover:text-blue-200 transition-colors">
                            <Bell size={20} />
                            <span className="absolute -top-1 -right-1 bg-rose-500 w-2 h-2 rounded-full border border-white"></span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-blue-500 border-2 border-white/20 flex items-center justify-center text-xs font-bold shadow-inner">
                            JD
                        </div>
                    </div>
                </div>
            </header>

            <main className="p-6 max-w-[1600px] mx-auto space-y-6">

                {/* Metric Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <MetricCard title="Bookings" value="42" trend="12% vs last week" icon={TrendingUp} colorClass="border-blue-500" />
                    <MetricCard title="Arrivals" value="18" subtext="12 Checked-in" icon={UserPlus} colorClass="border-[#003166]" />
                    <MetricCard title="Departures" value="24" subtext="8 Pending" icon={UserMinus} colorClass="border-indigo-500" />
                    <MetricCard title="In-House" value="156" subtext="Total Guests" icon={Home} colorClass="border-emerald-500" />
                    <MetricCard title="Occupied Rooms" value="88%" subtext="112 / 128 Rooms" icon={CheckCircle2} colorClass="border-cyan-500" />
                    <MetricCard title="Cancellations" value="3" subtext="View details" icon={XCircle} colorClass="border-rose-500" />
                </div>

                {/* REVENUE & YIELD ANALYTICS ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Revenue Management Forecast - Line Chart Mockup */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 lg:col-span-2">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <DollarSign size={18} style={{ color: BRAND_COLOR }} />
                                <h2 className="text-sm font-bold text-slate-800">Revenue Management Forecast (Oct)</h2>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                                    <span className="text-[10px] font-bold text-slate-500">Actual</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-slate-200"></span>
                                    <span className="text-[10px] font-bold text-slate-500">Budget</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-40 w-full relative flex items-end justify-between px-2 pt-4">
                            {/* Simple Visual Mock of a Line Chart */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                {/* Budget Path */}
                                <path d="M0,120 L100,100 L200,110 L300,90 L400,80 L500,85 L600,70 L700,60 L800,65 L900,50 L1000,55" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4" />
                                {/* Actual Path */}
                                <path d="M0,130 L100,110 L200,95 L300,85 L400,75 L500,65 L600,60 L700,50" fill="none" stroke="#2563eb" strokeWidth="3" />
                            </svg>
                            {/* Chart Labels */}
                            {[1, 5, 10, 15, 20, 25, 30].map(day => (
                                <span key={day} className="text-[9px] text-slate-400 font-bold mt-2">Oct {day}</span>
                            ))}
                        </div>
                    </div>

                    {/* ADR / RevPAR & Channel Mix */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp size={18} style={{ color: BRAND_COLOR }} />
                                <h2 className="text-sm font-bold text-slate-800">Yield Scoreboard</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">ADR</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xl font-bold">$244.50</span>
                                        <ChevronUp size={16} className="text-emerald-500" />
                                    </div>
                                    <p className="text-[9px] text-emerald-600 font-bold">+$12.20 vs yesterday</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">RevPAR</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xl font-bold">$215.16</span>
                                        <ChevronUp size={16} className="text-emerald-500" />
                                    </div>
                                    <p className="text-[9px] text-emerald-600 font-bold">+4% vs yesterday</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4">
                                <PieChart size={18} style={{ color: BRAND_COLOR }} />
                                <h2 className="text-sm font-bold text-slate-800">Channel Mix</h2>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="relative w-20 h-20">
                                    <svg viewBox="0 0 36 36" className="w-full h-full">
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#eee" strokeWidth="4"></circle>
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#003166" strokeWidth="4" strokeDasharray="45 100"></circle>
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="25 100" strokeDashoffset="-45"></circle>
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray="20 100" strokeDashoffset="-70"></circle>
                                        <circle cx="18" cy="18" r="16" fill="none" stroke="#f43f5e" strokeWidth="4" strokeDasharray="10 100" strokeDashoffset="-90"></circle>
                                    </svg>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#003166]"></div><span className="text-[10px] font-bold">Direct (45%)</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div><span className="text-[10px] font-bold">Booking (25%)</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div><span className="text-[10px] font-bold">Expedia (20%)</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div><span className="text-[10px] font-bold">Other (10%)</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Activity Tables & Availability */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Availability Search */}
                        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4 text-slate-800">
                                <Calendar size={18} style={{ color: BRAND_COLOR }} />
                                <h2 className="text-sm font-bold">Check Room Availability</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="md:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Stay Dates</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus-within:border-blue-400 transition-colors">
                                        <Calendar size={14} className="text-slate-400" />
                                        <input type="text" defaultValue="Oct 24 - Oct 27, 2023" className="bg-transparent text-sm w-full focus:outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Guests</label>
                                    <div className="relative">
                                        <Users size={14} className="absolute left-3 top-3.5 text-slate-400" />
                                        <select
                                            value={guestCount}
                                            onChange={(e) => setGuestCount(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-9 text-sm w-full focus:outline-none focus:border-blue-400 appearance-none"
                                        >
                                            <option>1 Adult, 0 Children</option>
                                            <option>2 Adults, 0 Children</option>
                                            <option>2 Adults, 1 Child</option>
                                            <option>4 Adults, 2 Children</option>
                                        </select>
                                    </div>
                                </div>
                                <button
                                    style={{ backgroundColor: BRAND_COLOR }}
                                    className="hover:opacity-90 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-all shadow-md active:scale-95"
                                >
                                    Check Availability
                                </button>
                            </div>
                        </section>

                        {/* Activity Tables */}
                        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="flex border-b border-slate-100 bg-slate-50/30">
                                <button
                                    onClick={() => setActiveTab('checkins')}
                                    className={`px-6 py-4 text-sm font-bold transition-all relative ${activeTab === 'checkins' ? 'text-[#003166]' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Today's Check-ins (18)
                                    {activeTab === 'checkins' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#003166]"></div>}
                                </button>
                                <button
                                    onClick={() => setActiveTab('checkouts')}
                                    className={`px-6 py-4 text-sm font-bold transition-all relative ${activeTab === 'checkouts' ? 'text-[#003166]' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Today's Check-outs (24)
                                    {activeTab === 'checkouts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#003166]"></div>}
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                {activeTab === 'checkins' ? (
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="text-slate-400 font-medium border-b border-slate-50">
                                                <th className="py-4 px-6">Guest Name</th>
                                                <th className="py-4 px-6">Room Type</th>
                                                <th className="py-4 px-6 text-center">Nights</th>
                                                <th className="py-4 px-6">Status</th>
                                                <th className="py-4 px-6 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {checkins.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{item.id}</div>
                                                    </td>
                                                    <td className="py-4 px-6 text-slate-600">{item.roomType}</td>
                                                    <td className="py-4 px-6 text-center font-medium">{item.nights}</td>
                                                    <td className="py-4 px-6">
                                                        <span className={`${item.statusColor} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <button className="text-[#003166] hover:underline font-bold text-xs">Manage</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="text-slate-400 font-medium border-b border-slate-50">
                                                <th className="py-4 px-6">Guest Name</th>
                                                <th className="py-4 px-6">Room</th>
                                                <th className="py-4 px-6 text-center">Balance</th>
                                                <th className="py-4 px-6">Status</th>
                                                <th className="py-4 px-6 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {checkouts.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-6 font-bold">{item.name}</td>
                                                    <td className="py-4 px-6 text-slate-600">{item.room}</td>
                                                    <td className="py-4 px-6 text-center text-rose-600 font-bold">{item.balance}</td>
                                                    <td className="py-4 px-6">
                                                        <span className={`${item.statusColor} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <button className="text-[#003166] hover:underline font-bold text-xs">Checkout</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar Column */}
                    <div className="space-y-6">

                        {/* Guest Experience & Reputation */}
                        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <Star size={18} className="text-amber-500" />
                                    <h2 className="text-sm font-bold text-slate-800">Sentiment Snapshot</h2>
                                </div>
                                <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                    <span className="text-xs font-black text-amber-700">4.8</span>
                                    <span className="text-[10px] text-amber-600">/ 5.0</span>
                                </div>
                            </div>

                            <div className="space-y-3 mb-5">
                                <div className="bg-slate-50 p-2 rounded border-l-2 border-emerald-500">
                                    <p className="text-[10px] italic text-slate-600">"Exceptional breakfast and the view from the sea suite is breathtaking..."</p>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[9px] font-bold text-slate-400">Google Reviews</span>
                                        <span className="text-[9px] font-bold text-emerald-600">Positive</span>
                                    </div>
                                </div>
                            </div>

                            {/* VIP Arrivals */}
                            <div className="border-t border-slate-100 pt-4 mb-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Crown size={16} className="text-[#003166]" />
                                    <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">VIP Arrivals Today</h3>
                                </div>
                                <div className="space-y-3">
                                    {vips.map((vip, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="w-1 bg-amber-400 rounded-full"></div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <p className="text-xs font-bold">{vip.name}</p>
                                                    <span className="text-[10px] font-bold text-[#003166]">{vip.eta}</span>
                                                </div>
                                                <p className="text-[9px] text-slate-500 font-medium">✨ {vip.preference}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Live Guest Requests Ticker */}
                            <div className="border-t border-slate-100 pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageSquare size={16} className="text-emerald-500" />
                                    <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Live Requests</h3>
                                </div>
                                <div className="bg-emerald-50/50 rounded-lg overflow-hidden border border-emerald-100">
                                    <div className="h-20 overflow-y-auto space-y-2 p-2">
                                        {guestRequests.map((req, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] py-1 border-b border-emerald-100/50 last:border-0">
                                                <span className="font-bold text-slate-700">Room {req.room}: {req.request}</span>
                                                <span className="text-slate-400 font-mono">{req.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Housekeeping Section */}
                        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <Brush size={18} style={{ color: BRAND_COLOR }} />
                                    <h2 className="text-sm font-bold text-slate-800">Housekeeping</h2>
                                </div>
                                <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">8 Urgent</span>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                        <span className="text-xs font-bold">Dirty Rooms</span>
                                    </div>
                                    <span className="text-sm font-bold">14</span>
                                </div>

                                <div className="border-t border-slate-100 pt-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Open Tasks</p>
                                    <div className="space-y-3">
                                        <div className="flex gap-3 items-start group cursor-pointer">
                                            <div className="mt-1 h-4 w-4 border-2 border-slate-200 rounded flex items-center justify-center group-hover:border-[#003166]">
                                                <div className="h-2 w-2 bg-[#003166] opacity-0 group-hover:opacity-100 rounded-sm transition-opacity"></div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold group-hover:text-[#003166] transition-colors">Linen Change - Room 302</p>
                                                <p className="text-[10px] text-slate-400">Assigned: Maria S. • 15m ago</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start group cursor-pointer">
                                            <div className="mt-1 h-4 w-4 border-2 border-slate-200 rounded flex items-center justify-center group-hover:border-[#003166]">
                                                <div className="h-2 w-2 bg-[#003166] opacity-0 group-hover:opacity-100 rounded-sm transition-opacity"></div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold group-hover:text-[#003166] transition-colors">Minibar Restock - Room 105</p>
                                                <p className="text-[10px] text-slate-400">Assigned: James K. • 40m ago</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Recent Reservations */}
                        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4">
                                <History size={18} style={{ color: BRAND_COLOR }} />
                                <h2 className="text-sm font-bold text-slate-800">Recent Reservations</h2>
                            </div>
                            <div className="space-y-4">
                                {recentReservations.map((res, i) => (
                                    <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#003166]">
                                                <UserPlus size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">{res.name}</p>
                                                <p className="text-[10px] text-slate-400">{res.nights} nights • {res.room}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-emerald-600">{res.price}</p>
                                            <div className="flex items-center justify-end text-[9px] text-slate-400">
                                                <Clock size={8} className="mr-0.5" /> {res.time}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="w-full mt-4 py-2.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter">
                                View All Bookings <ChevronRight size={12} />
                            </button>
                        </section>

                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;