import React, { useState, useEffect } from 'react';
import { User, SwapRequest, Machine } from '../types';
import { RefreshCw, Check, X, AlertTriangle, HelpCircle, DollarSign, Award, ChevronDown, MessageCircle, ArrowRight, UserCheck } from 'lucide-react';

interface SwapMarketplaceProps {
  user: User;
  token: string;
  selectedDate?: string;
  onOnboardingRequired?: () => void;
}

export default function SwapMarketplace({ user, token, selectedDate, onOnboardingRequired }: SwapMarketplaceProps) {
  const [swaps, setSwaps] = useState<any[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Swap Request Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formDate, setFormDate] = useState(selectedDate || '2026-06-25');
  const [formShiftCode, setFormShiftCode] = useState<'A' | 'B' | 'C' | 'OFF' | ''>('');
  const [fetchingShift, setFetchingShift] = useState(false);
  const [formSwapType, setFormSwapType] = useState<'open' | 'direct'>('open');
  const [formTargetUser, setFormTargetUser] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formIncentive, setFormIncentive] = useState(false);
  const [formIncentiveAmount, setFormIncentiveAmount] = useState('300');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Recommendation engine state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [fetchingRecs, setFetchingRecs] = useState(false);

  // Supervisor Approval state
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const fetchSwapsAndAssets = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch swap requests
      const resSwaps = await fetch('/api/swaps', { headers });
      const dataSwaps = await resSwaps.json();
      if (Array.isArray(dataSwaps)) setSwaps(dataSwaps);

      // 2. Fetch machines & employees
      const resAssets = await fetch('/api/assets', { headers });
      const dataAssets = await resAssets.json();
      if (dataAssets) {
        setMachines(dataAssets.machines || []);
        setEmployees(dataAssets.users?.filter((u: any) => u.id !== user.id && u.roleId === '1') || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwapsAndAssets();
    if (selectedDate) {
      setShowCreateModal(true);
    }
  }, [token, selectedDate]);

  const employeeId = user.id;

  // Fetch recommendations dynamically as date/shift changes in form
  const getRecommendations = async (date: string, code: string) => {
    try {
      setFetchingRecs(true);
      console.log(`[ShiftSwapDebug] Validation Shift: ${code}`);
      const res = await fetch(`/api/swaps/recommendations?date=${date}&shiftCode=${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setRecommendations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingRecs(false);
    }
  };

  const fetchShiftForDate = async (date: string) => {
    try {
      setFetchingShift(true);
      setRecommendations([]); // Remove stale recommendations / cached values
      setFormError(''); // Clear stale error
      console.log(`[ShiftSwapDebug] Selected Date: ${date}`);
      console.log(`[ShiftSwapDebug] Current Employee ID: ${employeeId}`);
      
      const res = await fetch(`/api/wfm/shift-for-date?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log(`[ShiftSwapDebug] Fetched Shift: ${data.shiftCode || 'OFF'}`);

      if (data.onboardingRequired) {
        alert('Your weekly shift pattern configuration is incomplete. Redirecting to onboarding...');
        if (onOnboardingRequired) {
          onOnboardingRequired();
        }
        return;
      }
      if (data.shiftCode) {
        setFormShiftCode(data.shiftCode);
      } else {
        setFormShiftCode('OFF');
      }
    } catch (e) {
      console.error('[SwapMarketplace] Error fetching shift for date:', e);
    } finally {
      setFetchingShift(false);
    }
  };

  useEffect(() => {
    if (showCreateModal && formDate) {
      setFormShiftCode(''); // Instantly clear stale shift code to avoid using it
      fetchShiftForDate(formDate);
    }
  }, [formDate, selectedDate, employeeId, showCreateModal]);

  useEffect(() => {
    // Wait until shift fetching completes and the shift code has been resolved
    if (showCreateModal && formDate && formShiftCode && !fetchingShift) {
      getRecommendations(formDate, formShiftCode);
    }
  }, [formDate, formShiftCode, showCreateModal, fetchingShift]);

  const handleCreateSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      const res = await fetch('/api/swaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          date: formDate,
          shiftCode: formShiftCode,
          swapType: formSwapType,
          targetUserId: formSwapType === 'direct' ? formTargetUser : undefined,
          remarks: formRemarks,
          incentiveOffered: formIncentive,
          incentiveAmount: formIncentiveAmount
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowCreateModal(false);
      fetchSwapsAndAssets();
      // Reset
      setFormRemarks('');
      setFormIncentive(false);
    } catch (err: any) {
      setFormError(err.message || 'Swap request creation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleVolunteer = async (swapId: string) => {
    if (!window.confirm('Do you want to volunteer for this shift? This will add you to a dedicated discussion thread.')) return;
    try {
      const res = await fetch(`/api/swaps/${swapId}/volunteer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('Successfully volunteered! Talk to the requester in the discussion thread.');
      fetchSwapsAndAssets();
    } catch (err: any) {
      alert(err.message || 'Failed to volunteer');
    }
  };

  const handleSelectVolunteer = async (swapId: string, volunteerId: string) => {
    if (!window.confirm('Confirm selecting this volunteer? This sends the swap request to Supervisor Sarah Connor.')) return;
    try {
      const res = await fetch(`/api/swaps/${swapId}/select-volunteer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ volunteerId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      alert('Volunteer selected! Awaiting Supervisor approval.');
      fetchSwapsAndAssets();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSupervisorApproval = async (swapId: string, approve: boolean) => {
    setApprovalSubmitting(true);
    try {
      const res = await fetch(`/api/swaps/${swapId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ approve, comment: approvalComment })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      alert(`Swap request successfully ${approve ? 'APPROVED' : 'REJECTED'}! Schedule updated autonomously.`);
      setApprovalComment('');
      fetchSwapsAndAssets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleCancelSwap = async (swapId: string) => {
    if (!window.confirm('Are you sure you want to cancel this swap?')) return;
    try {
      const res = await fetch(`/api/swaps/${swapId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      fetchSwapsAndAssets();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800';
      case 'rejected': return 'bg-rose-100 text-rose-800';
      case 'cancelled': return 'bg-slate-100 text-slate-500';
      case 'volunteer_selected': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      default: return 'bg-amber-100 text-amber-800 border border-amber-200';
    }
  };

  const isSupervisorOrAdmin = user.roleId === '2' || user.roleId === '3';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Shift Swap Marketplace</h3>
          <p className="text-xs text-slate-500 mt-0.5">Browse available trades or request swaps</p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 w-full sm:w-auto">
          {user.roleId === '1' && (
            <button
              onClick={() => {
                setFormDate(new Date().toISOString().split('T')[0]);
                setShowCreateModal(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-5 py-3 rounded-2xl shadow-lg shadow-orange-600/20 active:scale-95 transition text-sm w-full sm:w-auto"
            >
              Post Shift Trade
            </button>
          )}
          <button
            onClick={fetchSwapsAndAssets}
            className="bg-slate-100 hover:bg-slate-200 p-3 rounded-xl transition"
          >
            <RefreshCw className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          
          {/* --- SECTION 1: SUPERVISOR APPROVAL QUEUE --- */}
          {isSupervisorOrAdmin && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-600 mr-2.5"></span>
                Supervisor Review Queue
              </h4>

              {swaps.filter(s => s.status === 'volunteer_selected' || (s.status === 'pending' && s.swapType === 'direct' && isSupervisorOrAdmin)).length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-bold text-sm">
                  Approval desk empty! No pending swaps.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {swaps.filter(s => s.status === 'volunteer_selected' || (s.status === 'pending' && s.swapType === 'direct' && isSupervisorOrAdmin)).map(s => (
                    <div key={s.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xxs font-black bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded uppercase">
                            Volunteer Selected
                          </span>
                          <span className="text-xs text-slate-400 font-bold">{s.date}</span>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-b border-slate-200/60 pb-3">
                          <div>
                            <p className="text-xs text-slate-400 font-bold">REQUESTER</p>
                            <h5 className="font-extrabold text-slate-800">{s.requesterName} ({s.requesterClockId})</h5>
                            <span className="text-xs bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded">{s.shiftCode} Shift</span>
                          </div>
                          <ArrowRight className="h-5 w-5 text-slate-400" />
                          <div className="text-right">
                            <p className="text-xs text-slate-400 font-bold">VOLUNTEER</p>
                            <h5 className="font-extrabold text-slate-800">
                              {s.targetName || s.volunteers.find((v: any) => v.status === 'selected')?.volunteerName || 'General'}
                            </h5>
                            <span className="text-xs bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">OFF Day</span>
                          </div>
                        </div>

                        {s.remarks && (
                          <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-500 italic mt-3">
                            "{s.remarks}"
                          </div>
                        )}

                        {s.incentiveOffered && (
                          <div className="flex items-center space-x-1 text-emerald-700 font-extrabold text-xs mt-3 bg-emerald-50 px-2 py-1 rounded">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>Incentive Offered: ₹{s.incentiveAmount} (Financial record logging only)</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 space-y-3">
                        <input
                          type="text"
                          placeholder="Supervisor review comment (optional)"
                          value={approvalComment}
                          onChange={(e) => setApprovalComment(e.target.value)}
                          className="w-full text-xs font-medium px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleSupervisorApproval(s.id, true)}
                            disabled={approvalSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl transition shadow shadow-emerald-600/10"
                          >
                            Approve Trade
                          </button>
                          <button
                            onClick={() => handleSupervisorApproval(s.id, false)}
                            disabled={approvalSubmitting}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs py-3 rounded-xl transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* --- SECTION 2: THE TRADE MARKETPLACE --- */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
              Active Trade Opportunities
            </h4>

            {swaps.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-semibold text-sm">
                No shift trade postings found. Be the first to list!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {swaps.map(s => {
                  const isOwnRequest = s.requesterId === user.id;
                  const hasVolunteered = s.volunteers?.some((v: any) => v.volunteerId === user.id);
                  const selectedVol = s.volunteers?.find((v: any) => v.status === 'selected');

                  return (
                    <div key={s.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                      <div>
                        {/* Status line */}
                        <div className="flex justify-between items-center mb-3">
                          <span className={`text-xxs font-black uppercase px-2.5 py-0.5 rounded ${getStatusBadgeClass(s.status)}`}>
                            {s.status === 'volunteer_selected' ? 'Supervisor Pending' : s.status}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">{s.date}</span>
                        </div>

                        {/* Swap core detail */}
                        <div>
                          <p className="text-xxs text-slate-400 font-black uppercase">Original Employee</p>
                          <h5 className="font-extrabold text-slate-900 text-base">{s.requesterName}</h5>
                          <span className="text-xxs text-slate-400 font-semibold">Clock ID: {s.requesterClockId}</span>
                          
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs bg-amber-500 text-white font-extrabold px-2 py-0.5 rounded shadow-sm">
                              {s.shiftCode} Shift
                            </span>
                            <span className="text-slate-400 font-bold text-xs">for</span>
                            <span className="text-xs bg-slate-200 text-slate-700 font-extrabold px-2 py-0.5 rounded">
                              OFF Day / Swap
                            </span>
                          </div>
                        </div>

                        {/* Incentives */}
                        {s.incentiveOffered && (
                          <div className="mt-4 flex items-center space-x-1 text-emerald-800 bg-emerald-100/50 p-2 rounded-xl text-xs font-black">
                            <DollarSign className="h-4 w-4" />
                            <span>Incentive Cash: ₹{s.incentiveAmount}</span>
                          </div>
                        )}

                        {s.remarks && (
                          <div className="mt-3 text-xs italic text-slate-500 font-semibold border-l-2 border-orange-500 pl-2">
                            "{s.remarks}"
                          </div>
                        )}

                        {/* Volunteer statistics */}
                        {s.volunteers && s.volunteers.length > 0 && (
                          <div className="mt-4 bg-white/70 p-3 rounded-xl border border-slate-200/60">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Volunteers ({s.volunteers.length})</p>
                            <div className="space-y-2 mt-2">
                              {s.volunteers.map((v: any) => (
                                <div key={v.id} className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-700">{v.volunteerName}</span>
                                  {isOwnRequest && s.status === 'pending' && (
                                    <button
                                      onClick={() => handleSelectVolunteer(s.id, v.volunteerId)}
                                      className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-2.5 py-1 rounded-lg text-xxs transition shadow-sm"
                                    >
                                      Select
                                    </button>
                                  )}
                                  {v.status === 'selected' && (
                                    <span className="text-xxs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Selected</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Triggers */}
                      <div className="mt-6 border-t border-slate-200/60 pt-4">
                        {isOwnRequest ? (
                          s.status === 'pending' || s.status === 'volunteer_selected' ? (
                            <button
                              onClick={() => handleCancelSwap(s.id)}
                              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition"
                            >
                              Cancel Posting
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-semibold block text-center">Trade Completed</span>
                          )
                        ) : (
                          s.status === 'pending' && (
                            hasVolunteered ? (
                              <button
                                disabled
                                className="w-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs py-2.5 rounded-xl cursor-not-allowed"
                              >
                                Volunteered ✓
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVolunteer(s.id)}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs py-3 rounded-xl transition active:scale-95"
                              >
                                Volunteer for Shift
                              </button>
                            )
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CREATE TRADE REQUEST POPUP MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-orange-600 text-white p-5 flex justify-between items-center">
              <div>
                <h4 className="text-lg font-black">Post Shift Swap Request</h4>
                <p className="text-xs opacity-90">Set dates and details to look for pilots to swap</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="hover:bg-orange-700/60 p-2 rounded-full transition text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateSwap} className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg text-xs text-red-700 font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400">Shift Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-400">Your Scheduled Shift</label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      readOnly
                      value={
                        fetchingShift 
                          ? 'Checking Schedule...' 
                          : formShiftCode === 'A' 
                          ? 'Morning (A Shift)' 
                          : formShiftCode === 'B' 
                          ? 'Noon (B Shift)' 
                          : formShiftCode === 'C' 
                          ? 'Night (C Shift)' 
                          : formShiftCode === 'OFF'
                          ? 'Weekly Off (OFF)'
                          : 'None'
                      }
                      className={`block w-full px-4 py-3 border rounded-xl font-bold text-sm focus:outline-none cursor-not-allowed ${
                        formShiftCode === 'OFF' 
                          ? 'bg-rose-50 border-rose-200 text-rose-700' 
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400">Swap Type</label>
                <div className="flex bg-slate-100 p-1 rounded-xl mt-1">
                  <button
                    type="button"
                    onClick={() => setFormSwapType('open')}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition ${formSwapType === 'open' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Open Shift Marketplace
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSwapType('direct')}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition ${formSwapType === 'direct' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Direct Swap
                  </button>
                </div>
              </div>

              {formSwapType === 'direct' && (
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400">Target Employee (Pilot)</label>
                  <select
                    value={formTargetUser}
                    onChange={(e) => setFormTargetUser(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800"
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.clockId})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Intelligent Eligibility Recommendation Panel */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-xxs font-black text-orange-600 uppercase flex items-center">
                  <Award className="mr-1 h-3.5 w-3.5" />
                  Intelligent Matching Recommendations
                </span>
                {(fetchingShift || formShiftCode === '') ? (
                  <p className="text-xs text-slate-400 mt-2 font-bold flex items-center">
                    <RefreshCw className="animate-spin mr-1.5 h-3.5 w-3.5 text-orange-600" />
                    Resolving employee schedule...
                  </p>
                ) : fetchingRecs ? (
                  <p className="text-xs text-slate-400 mt-2 font-bold flex items-center">
                    <RefreshCw className="animate-spin mr-1.5 h-3.5 w-3.5 text-orange-600" />
                    Scanning certified builders...
                  </p>
                ) : recommendations.length === 0 ? (
                  <p className="text-xs text-slate-400 mt-2 font-bold">No eligible matching employees available. Ensure shift dates are correct.</p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {recommendations.slice(0, 3).map(rec => (
                      <div key={rec.userId} className="flex justify-between items-center text-xs border-b border-slate-200 pb-1.5 last:border-none last:pb-0">
                        <div>
                          <span className="font-bold text-slate-700">{rec.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold ml-1.5">Score: {rec.score}%</span>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">
                          {rec.notes.slice(0, 1).join('') || 'Eligible'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Incentives */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="form-incentive"
                    checked={formIncentive}
                    onChange={(e) => setFormIncentive(e.target.checked)}
                    className="h-5 w-5 text-orange-600 border-slate-300 rounded-md"
                  />
                  <label htmlFor="form-incentive" className="text-xs font-black uppercase text-slate-600 select-none cursor-pointer">
                    Offer Incentive? (Optional)
                  </label>
                </div>

                {formIncentive && (
                  <div className="relative rounded-xl shadow-sm w-full sm:w-40 shrink-0">
                    <div className="absolute top-3 left-3 text-slate-400 font-bold text-sm">₹</div>
                    <input
                      type="number"
                      value={formIncentiveAmount}
                      onChange={(e) => setFormIncentiveAmount(e.target.value)}
                      className="block w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-800"
                      placeholder="300"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400">Remarks / Reason</label>
                <textarea
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="mt-1 block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-800"
                  rows={2}
                  placeholder="E.g., Need to attend family doctor appointment."
                ></textarea>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting || fetchingShift || formShiftCode === '' || formShiftCode === 'OFF'}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl transition shadow active:scale-95"
                >
                  {formSubmitting 
                    ? 'Posting Trade...' 
                    : (fetchingShift || formShiftCode === '') 
                    ? 'Checking Schedule...' 
                    : formShiftCode === 'OFF' 
                    ? 'Cannot Swap on Off Day' 
                    : 'Post Shift Swap Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-5 py-3.5 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
