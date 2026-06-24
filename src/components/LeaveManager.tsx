import React, { useState, useEffect } from 'react';
import { User, LeaveRequest, LeaveBalance } from '../types';
import { Calendar, RefreshCw, Check, X, AlertTriangle, FileText, Send, UserX } from 'lucide-react';

interface LeaveManagerProps {
  user: User;
  token: string;
}

export default function LeaveManager({ user, token }: LeaveManagerProps) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [allPendingLeaves, setAllPendingLeaves] = useState<any[]>([]); // For Supervisor review list
  const [loading, setLoading] = useState(true);

  // Apply Leave Form State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<'Casual' | 'Sick' | 'Earned' | 'Emergency' | 'Unpaid'>('Casual');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Supervisor comment state
  const [supervisorComment, setSupervisorComment] = useState('');
  const [actioningLeaveId, setActioningLeaveId] = useState<string | null>(null);

  const fetchLeaveData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch personal leaves and balances
      const res = await fetch('/api/leaves', { headers });
      const data = await res.json();
      if (data) {
        setLeaves(data.leaves || []);
        setBalances(data.balances || []);
      }

      // 2. If Supervisor, fetch ALL leaves in the system to review
      if (user.roleId === '2' || user.roleId === '3') {
        // We'll reuse the supervisor status endpoint or fetch all and filter
        const resDashboard = await fetch('/api/supervisor/dashboard', { headers });
        const dataDashboard = await resDashboard.json();

        // Let's mock fetching all pending leaves of pilot employees
        const resSwaps = await fetch('/api/swaps', { headers }); // We need list of employees
        const dataSwaps = await resSwaps.json();

        // In a real DB we would query, let's fetch from our local db via a special assets/WFM fetch
        const resAssets = await fetch('/api/assets', { headers });
        const assets = await resAssets.json();

        // Let's filter pending leaves on the server if possible, or build a clean mock endpoint or fetch list
        // Let's do a fetch of leaves from our database file or simulate
        // To be safe, we'll fetch general assets and construct a robust pending list
        // Let's call the dashboard endpoint which has all stats!
        // We can mock fetching leaves, let's write a robust local simulation of fetching pending leaves
        // Since we are Express + Vite, we can just add a quick endpoint `/api/supervisor/leaves` if we want!
        // Wait, did we add it? No, but let's check what we did. In `api.ts` we have `/api/supervisor/dashboard` which gives pending counts. Let's add a robust fetch or mock it elegantly!
        // Actually, we can fetch all leaves for the supervisor by querying an endpoint or simulating. Let's add `/api/supervisor/leaves` to `api.ts` or fetch it from `/api/leaves` and expand for supervisors.
        // Wait, let's see. In `api.ts`, `/api/leaves` returns leaves *for the logged in user*. If the user is supervisor, can we fetch all? Yes! We can quickly make a mock fetch or edit `api.ts`. Let's check.
        // Let's view `api.ts` inside our mind. We can add a quick endpoint, but wait! We can also fetch from the existing endpoints. Let's see if we can fetch all leaves.
        // Actually, let's look at `api.ts` again. Let's use standard API fetch:
        const resAllLeaves = await fetch('/api/assets', { headers });
        const assetsData = await resAllLeaves.json();
        
        // Let's fetch all leaves. Since our backend saves everything, let's mock the supervisor leaves on the client by querying the database in memory or making an endpoint!
        // Let's just call a quick API endpoint `/api/leaves` but wait, in `api.ts` we wrote:
        // `apiRouter.get('/leaves', requireAuth, (req, res) => { const leaves = dbInstance.getLeaveRequests().filter(l => l.userId === req.user!.id); ... })`
        // Ah! If the user is supervisor, they can only see their own. Let's make an endpoint in `api.ts` to get all leaves for supervisors! That's extremely easy and perfect.
        // Wait! Let's edit `api.ts` to support `/api/supervisor/leaves` so supervisors can view and approve all team leaves!
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, [token]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ startDate, endDate, leaveType, remarks })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowApplyModal(false);
      setRemarks('');
      fetchLeaveData();
    } catch (err: any) {
      setFormError(err.message || 'Leave request failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave?')) return;
    try {
      const res = await fetch(`/api/leaves/${leaveId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      fetchLeaveData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Supervisor Approval logic
  const handleSupervisorApproval = async (leaveId: string, approve: boolean) => {
    try {
      const res = await fetch(`/api/leaves/${leaveId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ approve, comment: supervisorComment })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      alert(`Leave application ${approve ? 'APPROVED' : 'REJECTED'}. balances and rosters updated autonomously.`);
      setSupervisorComment('');
      setActioningLeaveId(null);
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 font-bold';
      case 'rejected': return 'bg-rose-100 text-rose-800 font-bold';
      default: return 'bg-amber-100 text-amber-800 font-bold';
    }
  };

  const isSupervisor = user.roleId === '2' || user.roleId === '3';

  // Let's fetch all pending leaves if supervisor
  useEffect(() => {
    if (isSupervisor) {
      // In our design, since we are doing full stack, let's fetch all leaves by adding a supervisor endpoint
      // Or we can query the database directly in a simulated client endpoint if needed!
      // To keep it 100% compliant, let's first fetch all active pilot leaves by calling an API or we can edit `api.ts` to add `/api/supervisor/leaves`. Let's do that in a bit.
      // Right now, let's make the client able to request `/api/supervisor/leaves` which we'll add to `api.ts`!
      const fetchSupervisorLeaves = async () => {
        try {
          const res = await fetch('/api/supervisor/leaves', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (Array.isArray(data)) setAllPendingLeaves(data);
        } catch (e) {
          console.error(e);
        }
      };
      fetchSupervisorLeaves();
    }
  }, [token, isSupervisor, actioningLeaveId]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Leave Manager</h3>
          <p className="text-xs text-slate-500 mt-0.5">Track and request paid & unpaid leaves</p>
        </div>

        <div className="flex space-x-2 w-full sm:w-auto">
          {user.roleId === '1' && (
            <button
              onClick={() => {
                setStartDate(new Date().toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
                setShowApplyModal(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-5 py-3 rounded-2xl shadow-lg shadow-orange-600/20 active:scale-95 transition text-sm w-full sm:w-auto animate-pulse"
            >
              Apply for Leave
            </button>
          )}
          <button onClick={fetchLeaveData} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-xl transition">
            <RefreshCw className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* --- BALANCE LIST --- */}
          {user.roleId === '1' && (
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-5 gap-4">
              {balances.map(b => {
                const total = b.allocated;
                const used = b.used;
                const pending = b.pending;
                const available = total - used - pending;

                return (
                  <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-orange-200 transition">
                    <div>
                      <span className="text-xxs font-black uppercase text-slate-400">{b.leaveType}</span>
                      <h4 className="text-2xl font-black text-slate-900 mt-1">{available} Days</h4>
                    </div>

                    <div className="mt-4 text-[10px] text-slate-500 font-bold space-y-1">
                      <div className="flex justify-between">
                        <span>Allocated:</span>
                        <span>{total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Used:</span>
                        <span className="text-emerald-600">{used}</span>
                      </div>
                      {pending > 0 && (
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <span className="text-amber-600">{pending}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}


          {/* --- SUPERVISOR ABSENCE REVIEWER --- */}
          {isSupervisor && (
            <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-600 mr-2.5"></span>
                Leave Approval Applications
              </h4>

              {allPendingLeaves.filter(l => l.status === 'pending').length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-bold text-sm">
                  Roster clear! No pending leave applications to review.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allPendingLeaves.filter(l => l.status === 'pending').map(l => (
                    <div key={l.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded uppercase">
                            {l.leaveType} Leave
                          </span>
                          <span className="text-xxs text-slate-400 font-bold">{new Date(l.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="mt-3">
                          <h5 className="font-extrabold text-slate-900 text-base">{l.employeeName}</h5>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">Clock ID: {l.employeeClockId}</p>
                          
                          <div className="mt-2.5 bg-white border border-slate-200/60 p-2.5 rounded-xl text-xs">
                            <span className="font-bold text-slate-700">Dates:</span> 
                            <span className="text-slate-600 font-medium ml-1">{l.startDate} to {l.endDate}</span>
                          </div>
                        </div>

                        {l.remarks && (
                          <p className="text-xs text-slate-500 font-semibold italic mt-3 bg-white border border-slate-200/60 p-2 rounded-lg">
                            "{l.remarks}"
                          </p>
                        )}
                      </div>

                      {actioningLeaveId === l.id ? (
                        <div className="mt-4 space-y-2">
                          <input
                            type="text"
                            placeholder="Add supervisor comment..."
                            value={supervisorComment}
                            onChange={(e) => setSupervisorComment(e.target.value)}
                            className="w-full text-xs font-medium px-3 py-2.5 bg-white border border-slate-200 rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleSupervisorApproval(l.id, true)}
                              className="bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleSupervisorApproval(l.id, false)}
                              className="bg-rose-50 text-rose-700 text-xs font-bold py-2 rounded-lg"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActioningLeaveId(l.id)}
                          className="mt-4 w-full bg-orange-600 text-white font-bold text-xs py-2.5 rounded-xl"
                        >
                          Review Application
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* --- LEAVE APPLICATION HISTORY --- */}
          {user.roleId === '1' && (
            <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
                Your Leave Application History
              </h4>

              {leaves.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-semibold text-sm">
                  No previous leave requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase rounded-l-xl">Leave Type</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Start Date</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">End Date</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Reason</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase rounded-r-xl">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaves.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900">{l.leaveType}</td>
                          <td className="px-4 py-3 text-slate-600 font-semibold">{l.startDate}</td>
                          <td className="px-4 py-3 text-slate-600 font-semibold">{l.endDate}</td>
                          <td className="px-4 py-3 text-slate-500 font-semibold italic">"{l.remarks || 'None'}"</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold capitalize ${getStatusStyle(l.status)}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {l.status === 'pending' ? (
                              <button
                                onClick={() => handleCancelLeave(l.id)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-extrabold px-3 py-1.5 rounded-lg text-xs transition"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="text-xxs text-slate-400 font-bold">Closed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- APPLY LEAVE MODAL --- */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-orange-600 text-white p-5 flex justify-between items-center">
              <div>
                <h4 className="text-lg font-black">Apply for Leave</h4>
                <p className="text-xs opacity-90">Roster adjustment with automatic balance planning</p>
              </div>
              <button onClick={() => setShowApplyModal(false)} className="hover:bg-orange-700/60 p-2 rounded-full transition text-white">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg text-xs text-red-700 font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-400">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800"
                >
                  <option value="Casual">Casual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Earned">Earned Leave</option>
                  <option value="Emergency">Emergency Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400">Remarks / Reason</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-800"
                  rows={3}
                  required
                  placeholder="State the reason clearly for Supervisor sarah connor."
                ></textarea>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3.5 rounded-xl transition shadow active:scale-95"
                >
                  {formSubmitting ? 'Submitting Application...' : 'Submit Application'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-5 py-3.5 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
