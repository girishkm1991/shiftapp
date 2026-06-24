import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CalendarDays, PlusCircle } from 'lucide-react';

interface CalendarViewProps {
  user: User;
  token: string;
  onNavigate: (tab: string, dateStr?: string) => void;
}

export default function CalendarView({ user, token, onNavigate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date('2026-06-24')); // Centered around June 2026 pilot dates
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [scheduleData, setScheduleData] = useState<{
    assignments: any[];
    leaves: any[];
    swaps: any[];
  }>({ assignments: [], leaves: [], swaps: [] });
  const [loading, setLoading] = useState(true);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wfm/schedule', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data) setScheduleData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [token]);

  // Calendar Helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrev = () => {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNext = () => {
    if (viewMode === 'monthly') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  // Resolve status and class formatting for a specific date
  const getDateStatus = (dateStr: string) => {
    const isLeave = scheduleData.leaves?.some(l => dateStr >= l.startDate && dateStr <= l.endDate);
    if (isLeave) {
      return { code: 'LEAVE', style: 'bg-rose-100 text-rose-800 border-rose-300' };
    }

    const swap = scheduleData.swaps?.find(s => s.date === dateStr);
    const assign = scheduleData.assignments?.find(a => a.date === dateStr);
    const code = assign ? assign.shiftCode : 'OFF';

    if (swap) {
      if (swap.status === 'approved') {
        return { code, label: 'Approved Swap', style: 'bg-emerald-100 text-emerald-800 border-emerald-300 border-2' };
      }
      return { code, label: 'Pending Swap', style: 'bg-amber-100 text-amber-800 border-amber-300 border border-dashed shadow-inner' };
    }

    switch (code) {
      case 'A': return { code, style: 'bg-amber-100 text-amber-900 border-amber-200' };
      case 'B': return { code, style: 'bg-sky-100 text-sky-900 border-sky-200' };
      case 'C': return { code, style: 'bg-indigo-100 text-indigo-950 border-indigo-200' };
      default: return { code: 'OFF', style: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
  };

  // Render Monthly Grid
  const renderMonthly = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    // Spacing for starting day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100 rounded-lg opacity-40"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = getDateStatus(dateStr);

      days.push(
        <button
          key={day}
          onClick={() => onNavigate('swap-marketplace', dateStr)}
          className={`h-24 p-2 bg-white border border-slate-100 rounded-xl flex flex-col justify-between items-start hover:border-orange-300 transition group relative text-left ${status.style}`}
        >
          <span className="text-sm font-bold text-slate-700 group-hover:text-orange-600 transition">{day}</span>
          
          <div className="w-full flex flex-col items-stretch space-y-1 mt-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-center py-0.5 rounded px-1 self-start bg-white/60">
              {status.code === 'LEAVE' ? 'ON LEAVE' : 
               status.code === 'A' ? 'Morning A' :
               status.code === 'B' ? 'Noon B' :
               status.code === 'C' ? 'Night C' : 'OFF'}
            </span>
            {status.label && (
              <span className="text-[9px] font-bold text-center px-1 rounded bg-white">
                {status.label}
              </span>
            )}
          </div>
        </button>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-slate-400 py-2">{d}</div>
        ))}
        {days}
      </div>
    );
  };

  // Render Weekly Grid
  const renderWeekly = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day); // Monday as start or Sunday? Sunday.

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const status = getDateStatus(dateStr);

      days.push(
        <button
          key={i}
          onClick={() => onNavigate('swap-marketplace', dateStr)}
          className={`p-4 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-between text-center min-h-[160px] hover:border-orange-300 transition ${status.style}`}
        >
          <span className="text-xs text-slate-400 font-bold uppercase">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
          <span className="text-2xl font-black text-slate-800">{d.getDate()}</span>

          <div className="flex flex-col items-center space-y-1 w-full">
            <span className="text-xxs font-black uppercase px-2 py-0.5 rounded bg-white/75">
              {status.code === 'LEAVE' ? 'ON LEAVE' : `Shift: ${status.code}`}
            </span>
            {status.label && (
              <span className="text-[9px] font-extrabold tracking-tight px-1.5 py-0.5 rounded bg-orange-600 text-white uppercase">
                {status.label}
              </span>
            )}
          </div>
        </button>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
        {days}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-100 p-2.5 rounded-xl text-orange-600">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Your Shift Calendar</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Manage and trade shifts visually</p>
          </div>
        </div>

        {/* View and month select */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition ${viewMode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition ${viewMode === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Week
            </button>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button onClick={handlePrev} className="p-2 hover:bg-white rounded-lg transition text-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-4 text-xs font-extrabold text-slate-700 min-w-[120px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={handleNext} className="p-2 hover:bg-white rounded-lg transition text-slate-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'monthly' ? renderMonthly() : renderWeekly()}

          {/* Color Legend explanation bar */}
          <div className="bg-slate-50 rounded-2xl p-4 flex flex-wrap justify-center gap-4 text-xs font-bold border border-slate-200/60">
            <div className="flex items-center space-x-2">
              <span className="h-4 w-4 rounded-md bg-amber-100 border border-amber-300"></span>
              <span className="text-slate-600">A (Morning)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-4 w-4 rounded-md bg-sky-100 border border-sky-300"></span>
              <span className="text-slate-600">B (Noon)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-4 w-4 rounded-md bg-indigo-100 border border-indigo-300"></span>
              <span className="text-slate-600">C (Night)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-4 w-4 rounded-md bg-rose-100 border border-rose-300"></span>
              <span className="text-slate-600">Leave</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-4 w-4 rounded-md bg-emerald-100 border-2 border-emerald-300"></span>
              <span className="text-slate-600">Approved Swap</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-4 w-4 rounded-md bg-amber-100 border border-amber-300 border-dashed"></span>
              <span className="text-slate-600">Pending Swap</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
