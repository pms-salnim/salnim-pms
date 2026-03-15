import React, { useState, useEffect } from 'react';
import {
  Waves,
  User,
  MapPin,
  Calendar,
  Wind,
  Sun,
  Coffee,
  MessageSquare,
  CreditCard,
  Star,
  Settings,
  ArrowRight,
  X,
  CheckCircle2,
  Plus,
  Minus,
  Navigation,
  Info,
  Clock,
  Sparkles,
  ChevronRight,
  Droplets,
  Bell,
  Utensils
} from 'lucide-react';

const App = () => {
  const [view, setView] = useState('login'); // 'login', 'dashboard'
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [activeTab, setActiveTab] = useState('home');

  // Mock Data
  const guestData = {
    name: "Youssef El Amrani",
    room: "Suite Singular – Sea View",
    dates: "12 – 16 August 2025",
    reservationId: "SH-458921",
    email: "y.amrani@example.com",
    phone: "+212 6XX-XXXXXX",
    dietary: "No gluten"
  };

  const activities = [
    {
      id: 1,
      title: "Kite Surf Experience",
      duration: "2 hours",
      price: "900 MAD",
      description: "Guided kite surf session in the world-renowned Dakhla lagoon. Perfect for all skill levels.",
      included: ["Professional Instructor", "Premium Gear", "Water & Snacks", "Safety Briefing"],
      icon: <Wind className="w-6 h-6 text-blue-500" />,
      image: "https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 2,
      title: "Desert Excursion – Dune Blanche",
      duration: "Half day",
      price: "750 MAD",
      description: "A breathtaking 4x4 tour through the desert dunes ending at the white sands meeting the turquoise water.",
      included: ["4x4 Transportation", "Professional Guide", "Traditional Tea", "Sunset Photo-stop"],
      icon: <Sun className="w-6 h-6 text-orange-500" />,
      image: "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 3,
      title: "Spa & Hammam",
      duration: "90 min",
      price: "600 MAD",
      description: "Traditional Moroccan relaxation ritual. Includes black soap scrub and argan oil massage.",
      included: ["Black Soap Treatment", "Kessa Scrub", "Relaxing Massage", "Herbal Tea Service"],
      icon: <Sparkles className="w-6 h-6 text-purple-500" />,
      image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 4,
      title: "Fishing & Sailing",
      duration: "3 hours",
      price: "850 MAD",
      description: "Local fishing trip with our experienced captain. Experience the bounty of the Atlantic.",
      included: ["Boat & Fuel", "Fishing Equipment", "Refreshments", "Fresh Catch Prep"],
      icon: <Waves className="w-6 h-6 text-teal-500" />,
      image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800"
    }
  ];

  const billItems = [
    { label: "Room charges (4 nights)", value: "6,400 MAD" },
    { label: "Spa Ritual (Aug 13)", value: "600 MAD" },
    { label: "Excursion (Aug 14)", value: "750 MAD" },
  ];

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const LoginScreen = () => (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-stone-800">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-stone-900 rounded-full">
              <Waves className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-serif tracking-tight">Singular Hotel</h1>
          <p className="text-stone-500 font-light">Digital Concierge Access</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setView('dashboard'); }} className="space-y-4 bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-stone-400 font-semibold ml-1">Reservation Number</label>
            <input
              required
              placeholder="e.g. SH-458921"
              className="w-full p-4 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-stone-200 transition-all outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-stone-400 font-semibold ml-1">Last Name</label>
            <input
              required
              placeholder="e.g. El Amrani"
              className="w-full p-4 bg-stone-50 border-none rounded-xl focus:ring-2 focus:ring-stone-200 transition-all outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-stone-900 text-white p-4 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 group"
          >
            Access My Stay
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
        <p className="text-center text-xs text-stone-400">Need help? Please contact the front desk.</p>
      </div>
    </div>
  );

  const ActivityModal = ({ item, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2rem] overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10 duration-500">
        <div className="relative h-64 flex-shrink-0">
          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/80 to-transparent">
            <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
            <div className="flex gap-4 mt-2 text-stone-200 text-sm">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {item.duration}</span>
              <span className="font-medium text-white">{item.price}</span>
            </div>
          </div>
        </div>

        <div className="p-8 overflow-y-auto space-y-6">
          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400">Description</h4>
            <p className="text-stone-600 leading-relaxed">{item.description}</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400">What's Included</h4>
            <ul className="grid grid-cols-1 gap-2">
              {item.included.map((inc, i) => (
                <li key={i} className="flex items-center gap-3 text-stone-600">
                  <div className="p-1 bg-stone-100 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-stone-400" />
                  </div>
                  <span className="text-sm">{inc}</span>
                </li>
              ))}
            </ul>
          </section>

          <button
            onClick={() => { triggerToast("Booking request sent!"); onClose(); }}
            className="w-full bg-stone-900 text-white p-4 rounded-2xl font-semibold hover:opacity-90 transition-opacity"
          >
            Confirm Booking Request
          </button>
        </div>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="min-h-screen bg-stone-50 pb-24 text-stone-800">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-100">
        <div className="max-w-screen-md mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-stone-900 rounded-lg">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">SINGULAR HOTEL</h2>
              <p className="text-[10px] text-stone-400 tracking-[0.2em]">DAKHLA BAY</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            CHECKED-IN
          </div>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-6 py-8 space-y-12">
        {/* Hero Section */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-serif text-stone-900">Welcome, {guestData.name.split(' ')[0]}</h1>
            <p className="text-stone-500 flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" /> {guestData.room}
            </p>
          </div>
          <div className="bg-stone-900 rounded-3xl p-6 text-white flex justify-between items-center shadow-xl">
            <div className="space-y-1">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Your Stay</p>
              <p className="text-sm font-medium">{guestData.dates}</p>
            </div>
            <div className="h-10 w-px bg-stone-800" />
            <div className="text-right space-y-1">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Confirmation</p>
              <p className="text-sm font-mono">{guestData.reservationId}</p>
            </div>
          </div>
        </section>

        {/* Tab Logic Mockup */}
        {activeTab === 'home' && (
          <>
            {/* Activities Card Grid */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">What can I do?</h3>
                <button className="text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-stone-600 transition-colors">See All</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activities.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedActivity(item)}
                    className="group bg-white rounded-3xl overflow-hidden border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <div className="h-40 relative overflow-hidden">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-sm">
                        {item.icon}
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <h4 className="font-semibold text-stone-900 group-hover:text-stone-600 transition-colors">{item.title}</h4>
                        <p className="text-xs text-stone-400 mt-1">{item.duration} • {item.price}</p>
                      </div>
                      <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-50">
                        <span className="text-xs font-bold text-stone-400">View Details</span>
                        <ChevronRight className="w-4 h-4 text-stone-300" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Requests */}
            <section className="space-y-6">
              <h3 className="text-lg font-semibold">Request something</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Towels", icon: <Waves className="w-5 h-5" /> },
                  { label: "Housekeeping", icon: <Sparkles className="w-5 h-5" /> },
                  { label: "Checkout", icon: <Clock className="w-5 h-5" /> },
                  { label: "Maintenance", icon: <Settings className="w-5 h-5" /> },
                  { label: "Wake-up", icon: <Bell className="w-5 h-5" /> },
                  { label: "In-room Dining", icon: <Utensils className="w-5 h-5" /> }
                ].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => triggerToast(`Request for ${s.label} received.`)}
                    className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-stone-100 shadow-sm hover:border-stone-300 transition-all gap-3 text-stone-600 font-medium text-sm active:bg-stone-50"
                  >
                    <div className="text-stone-400">{s.icon}</div>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'chat' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-semibold">Messages</h3>
            <div className="space-y-4 min-h-[400px]">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-stone-900 flex-shrink-0 flex items-center justify-center text-white text-[10px]">SH</div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-stone-100 shadow-sm space-y-1">
                  <p className="text-sm">Welcome to Singular Hotel, let us know if you need anything.</p>
                  <p className="text-[10px] text-stone-400 uppercase font-bold">Reception • 09:12</p>
                </div>
              </div>
              <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-stone-200 flex-shrink-0 flex items-center justify-center text-stone-600 text-[10px]">YA</div>
                <div className="bg-stone-900 p-4 rounded-2xl rounded-tr-none text-white space-y-1">
                  <p className="text-sm">Can I book the spa for tomorrow afternoon?</p>
                  <p className="text-[10px] text-stone-500 uppercase font-bold">You • 10:45</p>
                </div>
              </div>
            </div>
            <div className="fixed bottom-24 left-6 right-6 max-w-screen-md mx-auto">
              <div className="relative">
                <input
                  placeholder="Type a message..."
                  className="w-full p-4 pr-16 bg-white border border-stone-100 rounded-2xl shadow-xl outline-none focus:ring-2 focus:ring-stone-200"
                />
                <button className="absolute right-2 top-2 bottom-2 px-4 bg-stone-900 text-white rounded-xl text-xs font-bold">SEND</button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'bill' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-semibold">My Bill</h3>
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="p-6 space-y-4">
                {billItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-stone-50 last:border-0">
                    <span className="text-sm text-stone-500">{item.label}</span>
                    <span className="text-sm font-semibold">{item.value}</span>
                  </div>
                ))}
                <div className="pt-4 flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span className="text-stone-900">7,750 MAD</span>
                </div>
              </div>
              <div className="bg-stone-50 p-6 flex flex-col gap-3">
                <button className="w-full bg-stone-900 text-white p-4 rounded-2xl font-bold text-sm shadow-sm" onClick={() => triggerToast("Processing payment simulation...")}>PAY NOW</button>
                <button className="w-full bg-white border border-stone-200 text-stone-600 p-4 rounded-2xl font-bold text-sm" onClick={() => triggerToast("Invoice will be sent to your email.")}>DOWNLOAD INVOICE</button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
                <User className="w-12 h-12 text-stone-300" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">{guestData.name}</h3>
                <p className="text-sm text-stone-400">Guest Profile</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { label: "Email Address", val: guestData.email },
                { label: "Phone Number", val: guestData.phone },
                { label: "Language", val: "English (US)" },
                { label: "Dietary Notes", val: guestData.dietary },
              ].map((field, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">{field.label}</p>
                  <p className="text-sm font-medium">{field.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
              <h4 className="font-semibold">Your Experience</h4>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className={`w-8 h-8 cursor-pointer transition-colors ${star <= 4 ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} />
                ))}
              </div>
              <textarea
                className="w-full p-4 bg-stone-50 border-none rounded-xl text-sm min-h-[100px] outline-none"
                placeholder="Share your feedback..."
                defaultValue="Excellent stay so far, the staff is very attentive."
              />
              <button
                onClick={() => triggerToast("Thank you for sharing your experience!")}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold text-sm"
              >
                SUBMIT FEEDBACK
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-6 right-6 max-w-screen-sm mx-auto z-50">
        <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-full h-16 px-6 flex items-center justify-between">
          {[
            { id: 'home', icon: Waves },
            { id: 'chat', icon: MessageSquare },
            { id: 'bill', icon: CreditCard },
            { id: 'profile', icon: User },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-3 rounded-full transition-all duration-300 relative ${active ? 'bg-stone-900 text-white scale-110 shadow-lg' : 'text-stone-400 hover:text-stone-600'}`}
              >
                <Icon className="w-5 h-5" />
                {active && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-ping" />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-stone-900 text-white px-6 py-3 rounded-full shadow-2xl animate-in slide-in-from-top-4 duration-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wide uppercase">{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      {selectedActivity && <ActivityModal item={selectedActivity} onClose={() => setSelectedActivity(null)} />}
    </div>
  );

  return (
    <div className="font-sans antialiased bg-stone-50">
      {view === 'login' ? <LoginScreen /> : <Dashboard />}
    </div>
  );
};

export default App;