import React, { useState, useEffect } from 'react';
import { User, SwapRequest, LeaveRequest } from '../types';
import { Play, ClipboardList, CheckCircle, Clock, Users, ShieldAlert, Award, FileSpreadsheet, PlusCircle, UserX, MessageSquare, ArrowRight, Bell } from 'lucide-react';

interface DashboardProps {
  user: User;
  token: string;
  onNavigate: (tab: string) => void;
  openNotificationDrawer: () => void;
  unreadNotificationsCount: number;
}

export default function Dashboard({ user, token, onNavigate, openNotificationDrawer, unreadNotificationsCount }: DashboardProps) {
  const [employeeSchedule, setEmployeeSchedule] = useState<{
    todayShift: string;
    todayMachine: string;
    pendingRequests: any[];
  }>({ todayShift: 'A', todayMachine: 'TBM-01', pendingRequests: [] });

  const [supervisorData, setSupervisorData] = useState<{
    pendingSwapsCount: number;
    pendingLeavesCount: number;
    teamStatusToday: any[];
    teamCount: number;
  }>({ pendingSwapsCount: 0, pendingLeavesCount: 0, teamStatusToday: [], teamCount: 0 });

  const [adminData, setAdminData] = useState<{
    totalEmployees: number;
    activeSwaps: number;
    approvedLeavesThisMonth: number;
    auditLogs: any[];
  }>({ totalEmployees: 0, activeSwaps: 0, approvedLeavesThisMonth: 0, auditLogs: [] });

  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Employee specific schedule
      if (user.roleId === '1') {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Fetch personal schedule
        const res1 = await fetch('/api/wfm/schedule', { headers });
        const data1 = await res1.json();
        
        // Find today's assignment
        const todayAssign = data1.assignments?.find((a: any) => a.date === todayStr);
        
        // Fetch all swaps and leaves to show pending states
        const resSwaps = await fetch('/api/swaps', { headers });
        const swapsData = await resSwaps.json();
        const swaps = Array.isArray(swapsData) ? swapsData : [];
        
        const resLeaves = await fetch('/api/leaves', { headers });
        const leaves = await resLeaves.json();

        const pending = [
          ...(swaps.filter((s: any) => s.requesterId === user.id && s.status !== 'approved' && s.status !== 'rejected' && s.status !== 'cancelled') || []).map((s: any) => ({
            id: s.id,
            type: 'Swap Request',
            title: `Shift Swap (${s.date})`,
            subtitle: s.swapType === 'open' ? 'Posted in Open Marketplace' : `Direct request to ${s.targetName}`,
            status: s.status,
            date: s.date
          })),
          ...(leaves.leaves?.filter((l: any) => l.status === 'pending') || []).map((l: any) => ({
            id: l.id,
            type: 'Leave Request',
            title: `${l.leaveType} Leave Application`,
            subtitle: `${l.startDate} to ${l.endDate}`,
            status: 'pending',
            date: l.startDate
          }))
        ];

        setEmployeeSchedule({
          todayShift: todayAssign?.shiftCode || 'OFF',
          todayMachine: user.machineId === 'm1' ? 'TBM-01' : user.machineId === 'm2' ? 'TBM-02' : 'TBM-03',
          pendingRequests: pending
        });
      }

      // 2. Supervisor dashboard data
      if (user.roleId === '2' || user.roleId === '3') {
        const res = await fetch('/api/supervisor/dashboard', { headers });
        const data = await res.json();
        if (data) setSupervisorData(data);
      }

      // 3. Admin dashboard data
      if (user.roleId === '3') {
        const res = await fetch('/api/admin/dashboard', { headers });
        const data = await res.json();
        if (data) setAdminData(data);
      }
    } catch (e) {
      console.error('Error fetching dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user, token]);

  const handleExport = (type: 'PDF' | 'Excel') => {
    alert(`Generating & exporting ${type} report for builders section... Download started!`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200 border';
      case 'volunteer_selected': return 'bg-blue-100 text-blue-800 border-blue-200 border';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getShiftBadge = (code: string) => {
    switch (code) {
      case 'A': return 'bg-amber-500 text-white shadow-sm';
      case 'B': return 'bg-sky-600 text-white shadow-sm';
      case 'C': return 'bg-indigo-900 text-white shadow-sm';
      case 'LEAVE': return 'bg-rose-500 text-white shadow-sm';
      default: return 'bg-slate-200 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Welcome Back, {user.name}</h2>
          <p className="text-sm text-slate-500 font-medium">
            Clock ID: <span className="font-bold text-orange-600">{user.clockId}</span> • 
            Role: <span className="font-bold text-slate-700">
              {user.roleId === '3' ? 'System Administrator' : user.roleId === '2' ? 'Section Supervisor' : 'Tyre Builder'}
            </span>
          </p>
        </div>

        {/* Quick notification bell shortcut */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={openNotificationDrawer}
            className="relative bg-slate-100 hover:bg-slate-200 p-3 rounded-full transition active:scale-95 duration-100"
          >
            <Bell className="h-6 w-6 text-slate-700" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          
          <button 
            onClick={fetchDashboardData}
            className="bg-orange-50 hover:bg-orange-100 text-orange-700 px-4 py-2.5 rounded-xl font-bold text-sm transition"
          >
            Refresh Schedule
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* --- VIEW 1: EMPLOYEE ACTIONS & TODAY SHIFT --- */}
          {user.roleId === '1' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Today's Shift Main Core Card - WhatsApp Simple */}
              <div className="lg:col-span-2 bg-orange-600 rounded-3xl p-6 text-white shadow-lg shadow-orange-950/10 flex flex-col justify-between relative overflow-hidden">
                {/* Decorative tyre background graphic */}
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
                  <Award className="h-64 w-64 text-white" />
                </div>

                <div className="relative z-10">
                  <span className="bg-orange-600/90 text-white font-bold text-xs uppercase px-3 py-1.5 rounded-full tracking-wider">
                    Today's Active Shift
                  </span>
                  <div className="flex items-center space-x-4 mt-6">
                    <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black ${getShiftBadge(employeeSchedule.todayShift)}`}>
                      {employeeSchedule.todayShift}
                    </div>
                    <div>
                      <h3 className="text-3xl font-black tracking-tight">
                        {employeeSchedule.todayShift === 'A' ? 'Morning Shift' :
                         employeeSchedule.todayShift === 'B' ? 'Noon Shift' :
                         employeeSchedule.todayShift === 'C' ? 'Night Shift' : 'Weekly Off (OFF)'}
                      </h3>
                      <p className="text-sm text-slate-300 font-medium mt-1">
                        Machine: <span className="font-bold text-white">{employeeSchedule.todayMachine}</span> • Apollo Builders Section
                      </p>
                    </div>
                  </div>
                </div>

                {/* Big Large Core Buttons - WhatsApp Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 relative z-10">
                  <button 
                    onClick={() => onNavigate('swap-marketplace')}
                    className="flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-4 px-4 rounded-2xl shadow-lg shadow-orange-600/20 active:scale-95 transition duration-150 text-base"
                  >
                    <PlusCircle className="mr-2 h-6 w-6" />
                    Request Shift Swap
                  </button>
                  <button 
                    onClick={() => onNavigate('leave-manager')}
                    className="flex items-center justify-center bg-white/10 hover:bg-white/25 text-white font-extrabold py-4 px-4 rounded-2xl border border-white/10 active:scale-95 transition duration-150 text-base"
                  >
                    <ClipboardList className="mr-2 h-6 w-6" />
                    Apply Leave
                  </button>
                </div>
              </div>

              {/* Quick Status / Help Card */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">WhatsApp-Simple Shift Swaps</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">
                    Trading shifts is as easy as messaging:
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="bg-orange-50 text-orange-600 p-2 rounded-lg text-sm font-bold mt-0.5">1</div>
                      <p className="text-sm text-slate-600 font-medium">Create a swap request (open marketplace or directly with an employee).</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="bg-orange-50 text-orange-600 p-2 rounded-lg text-sm font-bold mt-0.5">2</div>
                      <p className="text-sm text-slate-600 font-medium">The system automatically recommends eligible employees and handles chat threads.</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="bg-orange-50 text-orange-600 p-2 rounded-lg text-sm font-bold mt-0.5">3</div>
                      <p className="text-sm text-slate-600 font-medium">Once a volunteer stands up and is selected, Supervisor Connor approves!</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between border border-slate-100 mt-6">
                  <span className="text-xs text-slate-400 font-bold">Training complete?</span>
                  <span className="bg-emerald-100 text-emerald-800 text-xxs font-black uppercase px-2 py-1 rounded-md">15 Min Trained</span>
                </div>
              </div>

              {/* Pending user requests panel */}
              <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-orange-600" />
                  Your Active Pending Approvals
                </h3>
                
                {employeeSchedule.pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-medium text-sm">
                    No active pending swap or leave applications. Everything is up-to-date!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employeeSchedule.pendingRequests.map(req => (
                      <div key={req.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex justify-between items-center">
                        <div>
                          <span className="text-xxs font-extrabold uppercase px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                            {req.type}
                          </span>
                          <h4 className="font-bold text-slate-900 text-base mt-1">{req.title}</h4>
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">{req.subtitle}</p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${getStatusColor(req.status)}`}>
                          {req.status === 'pending' ? 'Pending Approval' : 
                           req.status === 'volunteer_selected' ? 'Awaiting Review' : req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* --- VIEW 2: SUPERVISOR CONTROLS & REVIEW MATRIX --- */}
          {(user.roleId === '2' || user.roleId === '3') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Review metrics counters */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-orange-200 transition">
                <span className="text-xs font-black uppercase text-slate-400">Review Queue</span>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <h4 className="text-4xl font-black text-slate-900">{supervisorData.pendingSwapsCount}</h4>
                    <p className="text-sm text-slate-500 font-semibold mt-1">Pending Swap Approvals</p>
                  </div>
                  <button 
                    onClick={() => onNavigate('swap-marketplace')}
                    className="bg-orange-50 hover:bg-orange-100 p-3 rounded-full text-orange-600 transition"
                  >
                    <ArrowRight className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-orange-200 transition">
                <span className="text-xs font-black uppercase text-slate-400">Absence Planning</span>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <h4 className="text-4xl font-black text-slate-900">{supervisorData.pendingLeavesCount}</h4>
                    <p className="text-sm text-slate-500 font-semibold mt-1">Pending Leave Approvals</p>
                  </div>
                  <button 
                    onClick={() => onNavigate('leave-manager')}
                    className="bg-orange-50 hover:bg-orange-100 p-3 rounded-full text-orange-600 transition"
                  >
                    <ArrowRight className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-orange-200 transition">
                <span className="text-xs font-black uppercase text-slate-400">Total Pilot Crew</span>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <h4 className="text-4xl font-black text-slate-900">{supervisorData.teamCount} Pilots</h4>
                    <p className="text-sm text-slate-500 font-semibold mt-1">Builders Section Active</p>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-full text-slate-600">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Team availability spreadsheet matrix today */}
              <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center">
                      <ClipboardList className="mr-2 h-5 w-5 text-orange-600" />
                      Team Schedule Matrix (Today's Availability)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Live grid showing who is assigned to Morning, Noon, Night or Leave today.</p>
                  </div>

                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleExport('Excel')}
                      className="flex items-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3.5 py-2 rounded-xl text-xs font-extrabold transition"
                    >
                      <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                      Export Excel
                    </button>
                    <button 
                      onClick={() => handleExport('PDF')}
                      className="flex items-center bg-red-50 hover:bg-red-100 text-red-700 px-3.5 py-2 rounded-xl text-xs font-extrabold transition"
                    >
                      <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                      Export PDF
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-slate-500 uppercase rounded-l-xl">Clock ID</th>
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-slate-500 uppercase">Employee Name</th>
                        <th className="px-4 py-3 text-left text-xs font-extrabold text-slate-500 uppercase">Assigned Machine</th>
                        <th className="px-4 py-3 text-center text-xs font-extrabold text-slate-500 uppercase rounded-r-xl">Shift Status Today</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supervisorData.teamStatusToday.map(member => (
                        <tr key={member.userId} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-orange-600">{member.clockId}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{member.name}</td>
                          <td className="px-4 py-3 text-slate-500 font-semibold">{member.machineCode}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-black ${getShiftBadge(member.shiftCode)}`}>
                              {member.shiftCode === 'A' ? 'Morning Shift (A)' :
                               member.shiftCode === 'B' ? 'Noon Shift (B)' :
                               member.shiftCode === 'C' ? 'Night Shift (C)' :
                               member.shiftCode === 'LEAVE' ? `${member.leaveType || 'Casual'} Leave` : 'Weekly Off (OFF)'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* --- VIEW 3: SYSTEM ADMINISTRATION STATISTICS & AUDIT FEED --- */}
          {user.roleId === '3' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Pilot overall statistics counters */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-xs font-black uppercase text-slate-400">Total Pilot Segment</span>
                <h4 className="text-3xl font-black text-slate-900 mt-2">{adminData.totalEmployees} Employees</h4>
                <p className="text-xs text-slate-500 mt-1">Restricted to Builders Pilot Phase 1</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-xs font-black uppercase text-slate-400">Active Shift Trades</span>
                <h4 className="text-3xl font-black text-slate-900 mt-2">{adminData.activeSwaps} Trades</h4>
                <p className="text-xs text-slate-500 mt-1">Currently open or awaiting approvals</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-xs font-black uppercase text-slate-400">Approved Absences</span>
                <h4 className="text-3xl font-black text-slate-900 mt-2">{adminData.approvedLeavesThisMonth} Leaves</h4>
                <p className="text-xs text-slate-500 mt-1">This month approved statistics</p>
              </div>

              {/* Compliance Audit Log list stream */}
              <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center">
                  <ShieldAlert className="mr-2 h-5 w-5 text-orange-600" />
                  Compliance Audit Logs (Activity Streams)
                </h3>

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {adminData.auditLogs.map(log => (
                    <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col sm:flex-row justify-between text-xs gap-2">
                      <div>
                        <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-black uppercase mr-2 text-[10px]">
                          {log.action}
                        </span>
                        <span className="font-bold text-slate-700">User ID: {log.userId}</span>
                        {log.newValue && (
                          <p className="text-slate-500 mt-1 font-semibold break-all bg-white p-1.5 rounded border border-slate-200">
                            {log.newValue}
                          </p>
                        )}
                      </div>
                      <span className="text-slate-400 font-semibold shrink-0">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
