import React, { useState } from 'react';
import {
    ShieldCheck,
    Lock,
    Eye,
    EyeOff,
    Globe,
    ChevronDown
} from 'lucide-react';

const App = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        // Fixed h-screen and overflow-hidden ensures zero scrolling
        <div className="h-screen w-full bg-[#020617] flex font-sans text-slate-200 overflow-hidden">

            {/* LEFT PANEL: Marketing & Branding */}
            <div className="hidden lg:flex flex-1 relative flex-col justify-center px-12 xl:px-20 bg-gradient-to-br from-[#001e3c] to-[#020617]">

                {/* Background Decorative Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px]" />

                {/* Floating Abstract Cards - scaled down */}
                <div className="absolute top-10 left-10 w-48 h-64 bg-white/5 border border-white/10 rounded-[30px] rotate-[-15deg] backdrop-blur-sm" />
                <div className="absolute bottom-10 right-10 w-56 h-72 bg-white/5 border border-white/10 rounded-[30px] rotate-[10deg] backdrop-blur-sm" />

                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#ea580c] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <span className="text-white font-black text-lg">S</span>
                        </div>
                        <h2 className="text-xl font-black tracking-tight text-white uppercase italic">
                            Salnim <span className="text-orange-500">PMS</span>
                        </h2>
                    </div>

                    <div className="space-y-3 max-w-md">
                        <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tighter">
                            One platform to run <br />
                            your property <span className="text-orange-500 italic">smarter.</span>
                        </h1>
                        <p className="text-base text-slate-400 font-medium leading-relaxed">
                            The all-in-one operating system trusted by hotels and resorts worldwide.
                        </p>
                    </div>

                    <div className="space-y-4 pt-6">
                        <div className="flex items-center gap-4 group">
                            <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl group-hover:bg-orange-500/10 transition-all">
                                <ShieldCheck className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="font-bold text-white uppercase text-[10px] tracking-widest">Bank-grade Security</p>
                                <p className="text-xs text-slate-500">GDPR-ready & SSL Encrypted</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 group">
                            <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl group-hover:bg-orange-500/10 transition-all">
                                <Lock className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="font-bold text-white uppercase text-[10px] tracking-widest">Trusted Access</p>
                                <p className="text-xs text-slate-500">MFA & Role-based permissions</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL: Login Form - Tightened Container */}
            <div className="w-full lg:w-[540px] flex flex-col bg-[#020617] border-l border-white/5">

                {/* Main Center Area */}
                <div className="flex-1 flex flex-col justify-center items-center px-8 sm:px-12">
                    <div className="w-full max-w-sm space-y-6">
                        <div className="text-center space-y-1">
                            <h3 className="text-2xl font-black text-white italic tracking-tight">Welcome Back</h3>
                            <p className="text-xs text-slate-500 font-medium tracking-wide">Enter credentials to access the dashboard.</p>
                        </div>

                        <div className="bg-[#0f172a]/40 border border-white/5 p-7 rounded-[32px] shadow-2xl backdrop-blur-xl">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        defaultValue="hmed@gmail.com"
                                        className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Password</label>
                                        <button type="button" className="text-[9px] font-black text-orange-500 uppercase tracking-widest hover:underline">Forgot?</button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            defaultValue="password123"
                                            className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 px-1 py-1">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        className="w-3.5 h-3.5 rounded border-white/10 bg-[#020617] text-orange-500 focus:ring-0 accent-orange-500"
                                    />
                                    <label htmlFor="remember" className="text-[11px] text-slate-500 font-medium">Remember this device</label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white font-black text-[11px] tracking-widest uppercase py-4 rounded-xl shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Sign In <span className="w-1.5 h-1.5 rounded-full border border-white/50" /></>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 pt-5 border-t border-white/5 text-center space-y-3">
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Need a partner account?</p>
                                <button className="text-xs font-black text-orange-500 uppercase tracking-tight hover:underline">
                                    Request Property Access
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                <Lock className="w-2.5 h-2.5" />
                                SECURE ENCRYPTED PROTOCOL
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - Compact */}
                <footer className="py-6 px-8 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-5 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                        <button className="hover:text-slate-400">Privacy</button>
                        <button className="hover:text-slate-400">Terms</button>
                        <button className="flex items-center gap-1 hover:text-slate-400">
                            <Globe className="w-2.5 h-2.5" /> EN <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                    </div>
                    <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em]">
                        © 2025 SALNIM PMS.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default App;