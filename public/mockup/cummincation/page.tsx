import React, { useState } from 'react';
import { 
  Inbox, 
  Send, 
  AlertCircle, 
  Trash2, 
  Users, 
  MailWarning, 
  Archive, 
  UserCheck, 
  CalendarClock, 
  LogOut, 
  Star, 
  MessageSquare, 
  Bot, 
  Settings, 
  Mail, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  Paperclip,
  Smile,
  Phone,
  Video,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  Clock
} from 'lucide-react';

const App = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('portal-checked-in');
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Theme Constants
  const theme = {
    navy: "#003166",
    orange: "#ea580c",
    sidebar: "#f8fafc",
    border: "#e2e8f0"
  };

  // Mock Data: Navigation Structure
  const navigation = [
    {
      group: "MailBox",
      icon: <Mail className="w-4 h-4" />,
      items: [
        { id: 'mail-inbox', label: 'Inbox', icon: <Inbox /> },
        { id: 'mail-sent', label: 'Sent', icon: <Send /> },
        { id: 'mail-unread', label: 'Unread', icon: <MailWarning /> },
        { id: 'mail-spam', label: 'Spam', icon: <AlertCircle /> },
        { id: 'mail-trash', label: 'Trash', icon: <Trash2 /> },
        { id: 'mail-archived', label: 'Archived', icon: <Archive /> },
        { id: 'mail-contacts', label: 'Contacts', icon: <Users /> },
      ]
    },
    {
      group: "Guest Portal",
      icon: <Smartphone className="w-4 h-4" />,
      items: [
        { id: 'portal-inbox', label: 'All Portal Msgs', icon: <MessageSquare /> },
        { id: 'portal-checked-in', label: 'Checked-in', icon: <UserCheck /> },
        { id: 'portal-confirmed', label: 'Confirmed', icon: <CalendarClock /> },
        { id: 'portal-checked-out', label: 'Checked-out', icon: <LogOut /> },
        { id: 'portal-reviews', label: 'Reviews', icon: <Star /> },
      ]
    },
    {
      group: "Social & AI",
      items: [
        { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare className="text-emerald-500" /> },
        { id: 'chatbot', label: 'Chatbot Logs', icon: <Bot className="text-blue-500" /> },
      ]
    },
    {
      group: "Control",
      items: [
        { id: 'settings-email', label: 'Email Integration', icon: <Settings /> },
        { id: 'settings-auto-reply', label: 'Auto Reply', icon: <CheckCircle2 /> },
      ]
    }
  ];

  // Mock Data: Conversation List
  const messages = [
    {
      id: 1,
      name: "Youssef El Amrani",
      subject: "Extra pillow request",
      preview: "Hello, could we please have one more firm pillow in Room 304?",
      time: "10:12 AM",
      status: "Checked-in",
      channel: "portal",
      unread: true
    },
    {
      id: 2,
      name: "Sarah Jenkins",
      subject: "Airport Transfer Confirmation",
      preview: "I will be arriving at Dakhla airport at 4 PM tomorrow.",
      time: "09:45 AM",
      status: "Confirmed",
      channel: "portal",
      unread: false
    },
    {
      id: 3,
      name: "Guest 402",
      subject: "5-Star Review",
      preview: "Amazing stay! The kite surf lessons were top tier.",
      time: "Yesterday",
      status: "Checked-out",
      channel: "review",
      unread: false
    }
  ];

  return (
    <div className="flex h-screen bg-white text-slate-800 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside 
        className={`bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}
      >
        {/* Sidebar Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-200 bg-white">
          {!isSidebarCollapsed && <h1 className="font-black text-xl tracking-tighter" style={{ color: theme.navy }}>COMMUNICATIONS</h1>}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            {isSidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-8 no-scrollbar">
          {navigation.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!isSidebarCollapsed && (
                <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  {section.group}
                </p>
              )}
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                    activeTab === item.id 
                    ? 'bg-white shadow-sm text-[#003166] font-bold border border-slate-200' 
                    : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span className={`${activeTab === item.id ? 'text-[#ea580c]' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {React.cloneElement(item.icon, { size: 18 })}
                  </span>
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                  {!isSidebarCollapsed && item.id === 'mail-unread' && (
                    <span className="ml-auto bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">12</span>
                  )}
                </button>
              ))}
              <div className="pt-2 border-b border-slate-100 mx-3" />
            </div>
          ))}
        </nav>
      </aside>

      {/* CONVERSATION LIST */}
      <div className="w-96 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Search conversations..." 
              className="w-full bg-slate-50 border border-slate-200 p-2.5 pl-10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              {activeTab.replace('-', ' ').replace('portal', 'Portal')}
            </h3>
            <button className="p-1 hover:bg-slate-50 rounded text-slate-400">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {messages.map((msg) => (
            <div 
              key={msg.id}
              onClick={() => setSelectedMessage(msg)}
              className={`p-5 cursor-pointer hover:bg-slate-50 transition-colors relative ${selectedMessage?.id === msg.id ? 'bg-slate-50' : ''}`}
            >
              {msg.unread && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#ea580c] rounded-r-full" />}
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-bold ${msg.unread ? 'text-slate-900' : 'text-slate-600'}`}>{msg.name}</span>
                <span className="text-[10px] text-slate-400">{msg.time}</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 mb-1 truncate">{msg.subject}</p>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{msg.preview}</p>
              
              <div className="flex gap-2 mt-3">
                <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 bg-slate-100 rounded text-slate-500 border border-slate-200">
                  {msg.status}
                </span>
                {msg.channel === 'portal' && <Smartphone className="w-3 h-3 text-slate-300" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN WORKSPACE / CHAT VIEW */}
      <main className="flex-1 flex flex-col bg-slate-50/30">
        {selectedMessage ? (
          <>
            {/* Header */}
            <header className="px-8 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#003166] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner">
                  {selectedMessage.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    {selectedMessage.name}
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Active</span>
                  </h2>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Last active 2m ago via Guest Portal
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 border border-slate-200 transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 border border-slate-200 transition-colors">
                  <Video className="w-4 h-4" />
                </button>
                <div className="h-6 w-px bg-slate-200 mx-1" />
                <button className="flex items-center gap-2 bg-[#003166] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-slate-200">
                   VIEW RESERVATION <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </header>

            {/* Conversation Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* PMS Note */}
              <div className="flex justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm">
                  Conversation started via Guest Portal
                </span>
              </div>

              {/* Staff Bubble */}
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="p-4 bg-white rounded-2xl rounded-tl-none border border-slate-200 shadow-sm max-w-lg">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Marhaba! Welcome to Singular Hotel. I am Sofia from Reception. How can I assist you today?
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">Sofia • Reception • 10:05 AM</span>
                </div>
              </div>

              {/* Guest Bubble */}
              <div className="flex flex-row-reverse items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#ea580c] flex-shrink-0" />
                <div className="flex flex-col items-end space-y-1">
                  <div className="p-4 bg-[#003166] text-white rounded-2xl rounded-tr-none shadow-xl max-w-lg">
                    <p className="text-sm leading-relaxed">
                      {selectedMessage.preview}
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold mr-1 uppercase">Guest • {selectedMessage.time}</span>
                </div>
              </div>
            </div>

            {/* Input Footer */}
            <footer className="p-6 bg-white border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 transition-all focus-within:ring-4 focus-within:ring-slate-100 focus-within:bg-white">
                <textarea 
                  className="w-full bg-transparent border-none p-3 text-sm outline-none resize-none min-h-[100px]"
                  placeholder="Type a reply or use '/' for templates..."
                />
                <div className="flex items-center justify-between px-2 pb-2">
                  <div className="flex items-center gap-1">
                    <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><Paperclip className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><Smile className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><Bot className="w-4 h-4" /></button>
                  </div>
                  <button className="bg-[#ea580c] text-white px-6 py-2.5 rounded-xl font-black text-[11px] tracking-widest flex items-center gap-2 shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all">
                    SEND REPLY <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
             <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-slate-300" />
             </div>
             <h2 className="text-xl font-bold text-slate-800">Select a conversation</h2>
             <p className="text-sm text-slate-400 max-w-xs">
                Choose a message from the sidebar to view the full interaction history and respond to guests.
             </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;