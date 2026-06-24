import React, { useState, useEffect, useRef } from 'react';
import { User, Notification } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import SwapMarketplace from './components/SwapMarketplace';
import LeaveManager from './components/LeaveManager';
import ChatSystem from './components/ChatSystem';
import { Shield, ClipboardList, Calendar, RefreshCw, MessageSquare, Bell, LogOut, X, CheckSquare, Award } from 'lucide-react';
import { io } from 'socket.io-client';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // Sync token from localStorage on initial load
  useEffect(() => {
    const savedToken = localStorage.getItem('imvelo_token');
    const savedUser = localStorage.getItem('imvelo_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Socket.IO reference and live listener
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (token && user) {
      // Connect to server Socket.IO
      const socket = io();
      socketRef.current = socket;

      // Join individual user channel room
      socket.emit('join_user', user.id);

      // Listen for instant push notifications
      socket.on('notification', (newNotification: any) => {
        console.log('[Socket] Instant notification pushed:', newNotification);
        setNotifications(prev => {
          if (prev.some(n => n.id === newNotification.id)) return prev;
          return [newNotification, ...prev];
        });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token, user]);

  // Fetch in-app notifications
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
      // Poll notifications every 8 seconds
      const interval = setInterval(fetchNotifications, 8000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
  };

  const handleNavigate = (tab: string, dateStr?: string) => {
    setSelectedDate(dateStr);
    setActiveTab(tab);
  };

  // If not authenticated, render Login/Onboarding screen
  if (!token || !user) {
    return (
      <Login
        onLoginSuccess={(authToken, authenticatedUser) => {
          setToken(authToken);
          setUser(authenticatedUser);
        }}
      />
    );
  }

  const unreadNotifications = notifications.filter(n => !n.isRead);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* 1. Global Navigation Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            {/* Logo and branding */}
            <div className="flex items-center space-x-3">
              <div className="bg-orange-600 p-2 rounded-xl text-white shadow-md shadow-orange-600/10">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">Imvelo Shift</h1>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Apollo Tyres • Builders Section</span>
              </div>
            </div>

            {/* User profile section & alerts drawer toggle */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-extrabold text-slate-800">{user.name}</span>
                <span className="text-[10px] text-orange-600 font-extrabold uppercase">
                  Clock ID: {user.clockId}
                </span>
              </div>

              {/* Notification Badge Bell */}
              <button
                onClick={() => setShowNotificationDrawer(true)}
                className="relative bg-slate-100 hover:bg-slate-200 p-2.5 rounded-full text-slate-700 transition"
                id="notification-bell"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xxs font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center animate-bounce">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="bg-slate-100 hover:bg-rose-550 hover:bg-rose-50 hover:text-rose-600 p-2.5 rounded-full text-slate-500 transition"
                title="Log Out of System"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-6">
        
        {/* Navigation Sidebar Drawer */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm space-y-1.5 sticky top-24">
            
            <button
              onClick={() => handleNavigate('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-extrabold rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <CheckSquare className="h-5 w-5" />
              <span>Pilot Dashboard</span>
            </button>

            <button
              onClick={() => handleNavigate('calendar')}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-extrabold rounded-2xl transition-all ${activeTab === 'calendar' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Calendar className="h-5 w-5" />
              <span>Shift Calendar</span>
            </button>

            <button
              onClick={() => handleNavigate('swap-marketplace')}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-extrabold rounded-2xl transition-all ${activeTab === 'swap-marketplace' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <RefreshCw className="h-5 w-5" />
              <span>Swap Marketplace</span>
            </button>

            <button
              onClick={() => handleNavigate('leave-manager')}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-extrabold rounded-2xl transition-all ${activeTab === 'leave-manager' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <ClipboardList className="h-5 w-5" />
              <span>Leave Manager</span>
            </button>

            <button
              onClick={() => handleNavigate('chat-system')}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-extrabold rounded-2xl transition-all ${activeTab === 'chat-system' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/10' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <MessageSquare className="h-5 w-5" />
              <span>In-App Messages</span>
            </button>

            <div className="pt-4 mt-4 border-t border-slate-100 px-4 text-xs font-bold text-slate-400">
              BUILDERS SECTION • PILOT
            </div>
          </nav>
        </aside>

        {/* Core display panels switcher */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard
              user={user}
              token={token}
              onNavigate={handleNavigate}
              openNotificationDrawer={() => setShowNotificationDrawer(true)}
              unreadNotificationsCount={unreadNotifications.length}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              user={user}
              token={token}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'swap-marketplace' && (
            <SwapMarketplace
              user={user}
              token={token}
              selectedDate={selectedDate}
            />
          )}

          {activeTab === 'leave-manager' && (
            <LeaveManager
              user={user}
              token={token}
            />
          )}

          {activeTab === 'chat-system' && (
            <ChatSystem
              user={user}
              token={token}
            />
          )}
        </main>
      </div>

      {/* 3. Sliding alerts/notifications panel overlay */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div
              onClick={() => setShowNotificationDrawer(false)}
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm transition-opacity"
            ></div>

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5 text-orange-600" />
                    <h4 className="text-base font-black text-slate-900">System Notifications</h4>
                  </div>
                  <button
                    onClick={() => setShowNotificationDrawer(false)}
                    className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Notifications list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {notifications.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 font-bold text-sm">
                      No notifications yet. Roster up to date!
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-4 rounded-2xl border text-xs flex flex-col justify-between gap-3 ${n.isRead ? 'bg-slate-50 border-slate-200/50' : 'bg-orange-50/50 border-orange-200 shadow-sm'}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="font-extrabold text-slate-800 text-sm">{n.title}</span>
                            {!n.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(n.id)}
                                className="text-xxs font-black text-orange-600 hover:underline shrink-0"
                              >
                                Mark Read
                              </button>
                            )}
                          </div>
                          <p className="text-slate-500 font-semibold leading-relaxed">{n.body}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold self-end">
                          {new Date(n.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer close */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 text-center shrink-0">
                  <button
                    onClick={() => setShowNotificationDrawer(false)}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-3 rounded-xl transition text-xs"
                  >
                    Close Panel
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
