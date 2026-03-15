import React, { useState } from 'react';
import {
    TrendingUp,
    Clock,
    AlertTriangle,
    RotateCcw,
    Plus,
    ArrowRight,
    Calendar,
    DollarSign,
    FileText,
    Bell,
    ArrowUpRight,
    CreditCard,
    Banknote,
    Globe,
    MoreHorizontal,
    Mail
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie
} from 'recharts';

const App = () => {
    // --- State ---
    const [timeRange, setTimeRange] = useState('Last 30 Days');

    // --- Mock Data ---
    const REVENUE_TREND = [
        { date: 'Mon', paid: 4000, unpaid: 2400, prev: 3200 },
        { date: 'Tue', paid: 3000, unpaid: 1398, prev: 3800 },
        { date: 'Wed', paid: 2000, unpaid: 9800, prev: 2500 },
        { date: 'Thu', paid: 2780, unpaid: 3908, prev: 4100 },
        { date: 'Fri', paid: 1890, unpaid: 4800, prev: 3000 },
        { date: 'Sat', paid: 2390, unpaid: 3800, prev: 2200 },
        { date: 'Sun', paid: 3490, unpaid: 4300, prev: 2800 },
    ];

    const PAYMENT_METHODS = [
        { name: 'Credit Card', value: 45000, color: '#3b82f6' },
        { name: 'Bank Transfer', value: 25000, color: '#8b5cf6' },
        { name: 'Cash', value: 15000, color: '#10b981' },
        { name: 'Online Gateway', value: 12000, color: '#f59e0b' },
    ];

    const RECENT_ACTIVITY = [
        { id: 1, type: 'payment', title: 'Payment Received', ref: 'INV-2044', amount: 1250.00, time: '2 mins ago', icon: <DollarSign className="w-4 h-4" /> },
        { id: 2, type: 'invoice', title: 'Invoice Issued', ref: 'INV-2045', amount: 840.00, time: '45 mins ago', icon: <FileText className="w-4 h-4" /> },
        { id: 3, type: 'refund', title: 'Refund Processed', ref: 'PAY-992', amount: -150.00, time: '3 hours ago', icon: <RotateCcw className="w-4 h-4" /> },
        { id: 4, type: 'adjustment', title: 'Manual Adjustment', ref: 'ADJ-102', amount: 50.00, time: '5 hours ago', icon: <Plus className="w-4 h-4" /> },
        { id: 5, type: 'payment', title: 'Payment Received', ref: 'INV-2040', amount: 2200.00, time: '1 day ago', icon: <DollarSign className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Alerts Section */}
                <div className="space-y-2">
                    <AlertBanner
                        type="warning"
                        message="4 invoices are overdue by more than 30 days. Action required."
                        count={4}
                    />
                </div>

                {/* Header & Date Selector */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
                        <p className="text-slate-500 text-sm">Real-time health of your payments and billing.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        {['7D', '30D', '90D', 'YTD'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${timeRange === range ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {range}
                            </button>
                        ))}
                        <div className="w-px h-4 bg-slate-200 mx-1" />
                        <button className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 rounded-md flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            Custom
                        </button>
                    </div>
                </div>

                {/* 1. Financial Snapshot (Hero KPIs) */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <HeroMetric title="Total Revenue" value="$124,500" trend="+12.5%" isNet />
                    <HeroMetric title="Collected" value="$98,200" status="paid" />
                    <HeroMetric title="Outstanding" value="$22,100" status="pending" />
                    <HeroMetric title="Overdue" value="$4,200" status="overdue" />
                    <HeroMetric title="Refunds" value="$1,500" status="refund" />
                    <HeroMetric title="Net Revenue" value="$123,000" isHighlighted />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. Revenue Trend (Primary Chart) */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Revenue Trend</h3>
                                <p className="text-xs text-slate-400">Paid vs Unpaid collections</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-medium">
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Paid</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-200" /> Unpaid</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 border-t-2 border-dashed border-slate-300" /> Prev. Period</div>
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={REVENUE_TREND}>
                                    <defs>
                                        <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="paid" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPaid)" />
                                    <Area type="monotone" dataKey="unpaid" stroke="#cbd5e1" strokeWidth={2} fill="transparent" />
                                    <Line type="monotone" dataKey="prev" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 8. Quick Actions */}
                    <div className="space-y-4">
                        <div className="bg-slate-900 p-6 rounded-xl shadow-lg text-white">
                            <h3 className="text-sm font-bold mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-1 gap-2">
                                <ActionButton icon={<Plus className="w-4 h-4" />} label="Create Invoice" />
                                <ActionButton icon={<DollarSign className="w-4 h-4" />} label="Record Payment" />
                                <ActionButton icon={<Mail className="w-4 h-4" />} label="Send Reminders" />
                                <ActionButton icon={<RotateCcw className="w-4 h-4" />} label="Issue Refund" />
                                <ActionButton icon={<ArrowUpRight className="w-4 h-4" />} label="Export Financials" secondary />
                            </div>
                        </div>

                        {/* 9. Taxes Snapshot */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold">Tax Snapshot</h3>
                                <button className="text-[10px] font-bold text-blue-600 hover:underline">VIEW REPORT</button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Collected</p>
                                    <p className="text-lg font-bold">$8,240</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pending</p>
                                    <p className="text-lg font-bold text-amber-600">$1,105</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                <span className="text-xs text-slate-500">Effective Tax Rate</span>
                                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 rounded">7.2%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* 3. Payments Status */}
                    <StatusCard
                        title="Payment Status"
                        data={[
                            { label: 'Paid', value: 85, color: '#10b981' },
                            { label: 'Pending', value: 10, color: '#f59e0b' },
                            { label: 'Failed', value: 5, color: '#ef4444' }
                        ]}
                    />

                    {/* 4. Invoices Status */}
                    <StatusCard
                        title="Invoice Status"
                        data={[
                            { label: 'Paid', value: 70, color: '#3b82f6' },
                            { label: 'Unpaid', value: 20, color: '#94a3b8' },
                            { label: 'Overdue', value: 10, color: '#ef4444' }
                        ]}
                    />

                    {/* 5. Outstanding Risk Panel */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                Outstanding Risk
                            </h3>
                            <button className="text-xs font-bold text-rose-600 flex items-center gap-1">
                                View All Overdue <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Oldest Unpaid</p>
                                <p className="text-xl font-bold">42 Days</p>
                            </div>
                            <div className="md:col-span-2 space-y-3">
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Top 3 Unpaid</p>
                                {[
                                    { name: 'Smith Residence', amount: 2400, age: '14d' },
                                    { name: 'Global Tech Corp', amount: 1850, age: '32d' },
                                    { name: 'Apartment 4B', amount: 900, age: '42d' },
                                ].map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs">
                                        <span className="font-medium text-slate-600">{item.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-400">{item.age}</span>
                                            <span className="font-bold">${item.amount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 6. Recent Activity Feed */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="text-sm font-bold">Recent Activity</h3>
                            <button className="p-1.5 hover:bg-slate-50 rounded-lg"><MoreHorizontal className="w-4 h-4 text-slate-400" /></button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {RECENT_ACTIVITY.map((act) => (
                                <div key={act.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${act.type === 'payment' ? 'bg-emerald-50 text-emerald-600' :
                                                act.type === 'refund' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                                            }`}>
                                            {act.icon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">{act.title}</p>
                                            <p className="text-xs text-slate-400">{act.ref} • {act.time}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-sm font-bold ${act.amount < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                            {act.amount < 0 ? '-' : ''}${Math.abs(act.amount).toLocaleString()}
                                        </span>
                                        <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 border-t border-slate-50 bg-slate-50/20">
                            VIEW ALL ACTIVITY
                        </button>
                    </div>

                    {/* 7. Payment Methods Breakdown */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold mb-6">Payment Methods Breakdown</h3>
                        <div className="space-y-5">
                            {PAYMENT_METHODS.map((method) => (
                                <div key={method.name} className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-medium text-slate-600">{method.name}</span>
                                        <span className="font-bold">${method.value.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${(method.value / 97000) * 100}%`,
                                                backgroundColor: method.color
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-50">
                            <div className="p-4 bg-blue-50 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-blue-400 uppercase">Top Channel</p>
                                    <p className="text-sm font-bold text-blue-700">Credit Card (46%)</p>
                                </div>
                                <CreditCard className="w-6 h-6 text-blue-300" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

// --- Sub-components ---

const HeroMetric = ({ title, value, trend, status, isNet, isHighlighted }) => (
    <div className={`p-4 rounded-xl border shadow-sm ${isHighlighted ? 'bg-white border-blue-200 ring-2 ring-blue-500/5' : 'bg-white border-slate-200'}`}>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
            <span className={`text-lg font-black ${isHighlighted ? 'text-blue-600' : 'text-slate-900'}`}>{value}</span>
            {trend && <span className="text-[10px] font-bold text-emerald-500">{trend}</span>}
        </div>
        <div className="mt-2 h-1 w-full bg-slate-50 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${status === 'paid' ? 'bg-emerald-400 w-3/4' :
                    status === 'pending' ? 'bg-amber-400 w-1/4' :
                        status === 'overdue' ? 'bg-rose-400 w-[10%]' :
                            status === 'refund' ? 'bg-slate-300 w-[5%]' :
                                isNet ? 'bg-blue-400 w-full' : 'bg-slate-200 w-0'
                }`} />
        </div>
    </div>
);

const ActionButton = ({ icon, label, secondary }) => (
    <button className={`w-full flex items-center justify-between p-3 rounded-lg text-xs font-bold transition-all ${secondary
            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
        }`}>
        <span className="flex items-center gap-3">
            {icon}
            {label}
        </span>
        <ArrowRight className="w-3 h-3 opacity-50" />
    </button>
);

const StatusCard = ({ title, data }) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold mb-4">{title}</h3>
        <div className="flex items-center gap-6">
            <div className="w-20 h-20">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={25}
                            outerRadius={38}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
                {data.map((item) => (
                    <div key={item.label} className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}
                        </span>
                        <span className="font-bold text-slate-900">{item.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const AlertBanner = ({ type, message, count }) => (
    <div className={`flex items-center justify-between p-3 px-4 rounded-lg border text-xs font-medium ${type === 'warning' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'
        }`}>
        <div className="flex items-center gap-3">
            <Bell className="w-4 h-4" />
            {message}
        </div>
        <div className="flex items-center gap-3">
            <button className="underline font-bold">Details</button>
            <button className="opacity-50 hover:opacity-100">Dismiss</button>
        </div>
    </div>
);

export default App;