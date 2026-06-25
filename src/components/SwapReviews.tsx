import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Search, Filter, ArrowUpDown, Check, X, AlertCircle, 
  MessageSquare, Clock, Shield, ChevronDown, CheckCircle2, AlertTriangle, Calendar
} from 'lucide-react';

interface SwapReviewsProps {
  user: any;
  token: string;
}

export default function SwapReviews({ user, token }: SwapReviewsProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // PENDING_ADMIN_REVIEW, UNDER_REVIEW, APPROVED, REJECTED, ALL
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [reviewerFilter, setReviewerFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Decision Modal state
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [decisionType, setDecisionType] = useState<'Approve' | 'Reject' | 'Clarification' | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch reviews on mount
  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reviews', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch review requests');
      }
      const data = await res.json();
      setReviews(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading review requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [token]);

  // Handle Sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Submit decision
  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview || !decisionType) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/reviews/${selectedReview.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          decision: decisionType,
          comments
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit review decision');
      }

      // Success
      setSelectedReview(null);
      setDecisionType(null);
      setComments('');
      await fetchReviews();
    } catch (err: any) {
      alert(err.message || 'Error submitting decision');
    } finally {
      setSubmitting(false);
    }
  };

  // Get distinct values for filter drop-downs
  const sections = Array.from(new Set(reviews.map(r => r.section?.name).filter(Boolean)));
  const reviewers = Array.from(new Set(
    reviews.flatMap(r => r.assignments?.map((a: any) => a.reviewerName).filter(Boolean))
  ));

  // Sort and filter reviews
  const filteredReviews = reviews.filter(rev => {
    // Search filter
    const searchString = `${rev.id} ${rev.requester?.name || ''} ${rev.volunteer?.name || ''} ${rev.swap?.date || ''}`.toLowerCase();
    if (searchTerm && !searchString.includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING' && rev.status !== 'PENDING_ADMIN_REVIEW' && rev.status !== 'UNDER_REVIEW') return false;
      if (statusFilter === 'PENDING_ADMIN_REVIEW' && rev.status !== 'PENDING_ADMIN_REVIEW') return false;
      if (statusFilter === 'UNDER_REVIEW' && rev.status !== 'UNDER_REVIEW') return false;
      if (statusFilter === 'APPROVED' && rev.status !== 'APPROVED') return false;
      if (statusFilter === 'REJECTED' && rev.status !== 'REJECTED') return false;
    }

    // Section filter
    if (sectionFilter !== 'ALL' && rev.section?.name !== sectionFilter) {
      return false;
    }

    // Reviewer filter
    if (reviewerFilter !== 'ALL') {
      const hasReviewer = rev.assignments?.some((a: any) => a.reviewerName === reviewerFilter);
      if (!hasReviewer) return false;
    }

    // Date range filter
    if (startDate && rev.swap?.date && rev.swap.date < startDate) return false;
    if (endDate && rev.swap?.date && rev.swap.date > endDate) return false;

    return true;
  }).sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    if (sortField === 'date') {
      valA = a.swap?.date || '';
      valB = b.swap?.date || '';
    } else if (sortField === 'requester') {
      valA = a.requester?.name || '';
      valB = b.requester?.name || '';
    } else if (sortField === 'volunteer') {
      valA = a.volunteer?.name || '';
      valB = b.volunteer?.name || '';
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="bg-slate-50 min-h-screen p-1 sm:p-4 rounded-3xl" id="swap-reviews-panel">
      {/* Header section */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 p-3 rounded-2xl text-white shadow-lg shadow-orange-600/10">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Shift Swap Approval Reviews</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Multi-level Supervisor & Admin Verification Flow</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-500 bg-slate-100 px-3.5 py-1.5 rounded-xl">
          <Clock className="h-4 w-4 text-orange-600" />
          <span>PILOT POLICY: MAX 3 REVIEWERS • MIN 2 APPROVALS</span>
        </div>
      </div>

      {/* Filter and search bento grid */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search request ID, name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 focus:bg-white text-xs font-bold text-slate-800 rounded-2xl outline-none transition"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-xs font-bold text-slate-800 rounded-2xl outline-none appearance-none cursor-pointer transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Active Pending Review</option>
              <option value="PENDING_ADMIN_REVIEW">Pending Action</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Section Filter */}
          <div className="relative">
            <Shield className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-xs font-bold text-slate-800 rounded-2xl outline-none appearance-none cursor-pointer transition"
            >
              <option value="ALL">All Sections</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Assigned Reviewer Filter */}
          <div className="relative">
            <ClipboardCheck className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <select
              value={reviewerFilter}
              onChange={(e) => setReviewerFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-xs font-bold text-slate-800 rounded-2xl outline-none appearance-none cursor-pointer transition"
            >
              <option value="ALL">All Assigned Reviewers</option>
              {reviewers.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Date range filters */}
          <div className="col-span-1 md:col-span-2 flex gap-3 items-center">
            <span className="text-xxs font-black text-slate-400 uppercase tracking-wider shrink-0">Shift Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 rounded-xl outline-none"
            />
            <span className="text-slate-400 text-xs font-extrabold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700 rounded-xl outline-none"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xxs font-black text-rose-600 hover:underline cursor-pointer"
              >
                Clear Range
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Reviews List / Table */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-slate-400 font-extrabold text-sm">Loading active swap reviews...</p>
          </div>
        ) : error ? (
          <div className="py-24 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
            <p className="text-slate-800 font-extrabold text-sm mb-1">{error}</p>
            <p className="text-slate-400 text-xs">Ensure you have sufficient admin/supervisor permissions.</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-24 text-center">
            <ClipboardCheck className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-extrabold text-sm">No swap review requests match your filters.</p>
            <p className="text-slate-400 text-xs mt-1">Active swap requests requiring Supervisor attention will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-xxs font-black uppercase tracking-wider">
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('id')}>
                    <div className="flex items-center space-x-1.5">
                      <span>Request ID</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('requester')}>
                    <div className="flex items-center space-x-1.5">
                      <span>Original Employee</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('volunteer')}>
                    <div className="flex items-center space-x-1.5">
                      <span>Volunteer Employee</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                    <div className="flex items-center space-x-1.5">
                      <span>Shift details</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-4 px-6">Work Section</th>
                  <th className="py-4 px-6">Reviewer Progress</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">
                {filteredReviews.map((rev) => {
                  const isPending = rev.status === 'PENDING_ADMIN_REVIEW' || rev.status === 'UNDER_REVIEW';
                  const userAlreadyDecided = rev.decisions?.some((d: any) => d.reviewerUserId === user.id);
                  const isEligibleReviewer = user.id !== rev.swap?.requesterId && user.id !== rev.volunteerUserId;
                  const canAct = isPending && !userAlreadyDecided && isEligibleReviewer;

                  return (
                    <tr key={rev.id} className="hover:bg-slate-50/50 transition">
                      
                      {/* ID */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-slate-500 font-bold">{rev.id}</span>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Requester (Original Employee) */}
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-800">{rev.requester?.name}</div>
                        <div className="text-xxs font-bold text-slate-400">CLOCK: {rev.requester?.clockId}</div>
                        <div className="text-xxs font-bold text-orange-600 mt-1 uppercase">
                          Giving: {rev.swap?.shiftCode} Shift
                        </div>
                      </td>

                      {/* Volunteer */}
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-800">{rev.volunteer?.name}</div>
                        <div className="text-xxs font-bold text-slate-400">CLOCK: {rev.volunteer?.clockId}</div>
                        <div className="text-xxs font-bold text-emerald-600 mt-1 uppercase">
                          Giving: {rev.swap?.requestedShiftCode || 'OFF'} Shift
                        </div>
                      </td>

                      {/* Shift Details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1 font-bold text-slate-800">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{rev.swap?.date}</span>
                        </div>
                        <div className="text-xxs text-slate-400 font-bold mt-1 uppercase">
                          Exchange: {rev.swap?.shiftCode} ⇄ {rev.swap?.requestedShiftCode || 'OFF'}
                        </div>
                      </td>

                      {/* Section / Machine */}
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-800">{rev.section?.name || 'Builders Section'}</div>
                        <div className="text-xxs font-bold text-slate-400 mt-0.5">{rev.machine?.name || 'All Machines'}</div>
                      </td>

                      {/* Reviewer Progress */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${rev.status === 'APPROVED' ? 'bg-emerald-500' : rev.status === 'REJECTED' ? 'bg-rose-500' : 'bg-orange-500'}`} 
                              style={{ width: `${(rev.approvalsReceived / rev.approvalsRequired) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-black text-slate-600 shrink-0">
                            {rev.approvalsReceived} of {rev.approvalsRequired} OKs
                          </span>
                        </div>

                        {/* Decision comment list snippet */}
                        {rev.decisions && rev.decisions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {rev.decisions.map((dec: any) => (
                              <div key={dec.id} className="text-[10px] flex items-center space-x-1.5 text-slate-500 font-bold">
                                {dec.decision === 'Approve' ? (
                                  <span className="text-emerald-600">✔</span>
                                ) : (
                                  <span className="text-rose-600">✖</span>
                                )}
                                <span>{dec.reviewerName}:</span>
                                <span className="font-semibold text-slate-400 truncate max-w-[120px]">{dec.comments || 'No comment'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xxs font-black uppercase tracking-wider ${
                          rev.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          rev.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          rev.status === 'UNDER_REVIEW' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          rev.status === 'PENDING_ADMIN_REVIEW' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {rev.status === 'PENDING_ADMIN_REVIEW' ? 'Pending Review' : rev.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        {canAct ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedReview(rev);
                                setDecisionType('Approve');
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-3 py-1.5 rounded-xl transition text-xxs flex items-center space-x-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedReview(rev);
                                setDecisionType('Reject');
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold px-3 py-1.5 rounded-xl transition text-xxs flex items-center space-x-1"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedReview(rev);
                                setDecisionType('Clarification');
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-3 py-1.5 rounded-xl transition text-xxs flex items-center space-x-1"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                              <span>Clarify</span>
                            </button>
                          </div>
                        ) : !isEligibleReviewer ? (
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase italic">Owner/Volunteer</span>
                        ) : userAlreadyDecided ? (
                          <span className="text-[10px] text-emerald-600 font-extrabold uppercase flex items-center justify-end gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Voted</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic">Resolved</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision comment modal */}
      {selectedReview && decisionType && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedReview(null)}></div>
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 relative max-w-md w-full z-10">
            <h3 className="text-base font-black text-slate-900 mb-2 flex items-center gap-2">
              {decisionType === 'Approve' && <Check className="h-5 w-5 text-emerald-600 bg-emerald-50 rounded-full p-0.5" />}
              {decisionType === 'Reject' && <X className="h-5 w-5 text-rose-600 bg-rose-50 rounded-full p-0.5" />}
              {decisionType === 'Clarification' && <MessageSquare className="h-5 w-5 text-slate-600 bg-slate-50 rounded-full p-0.5" />}
              <span>Submit Review Decision</span>
            </h3>
            <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-4">
              Reviewing Request {selectedReview.id} for swap on {selectedReview.swap?.date}
            </p>

            <form onSubmit={handleDecisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xxs font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Type of action
                </label>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>Decision:</span>
                  <span className={`font-black uppercase tracking-wider ${
                    decisionType === 'Approve' ? 'text-emerald-700' :
                    decisionType === 'Reject' ? 'text-rose-700' : 'text-slate-700'
                  }`}>
                    {decisionType}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xxs font-black text-slate-400 uppercase tracking-wider mb-1.5">
                  Decision Comments / Request Clarification notes
                </label>
                <textarea
                  required={decisionType === 'Clarification'}
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    decisionType === 'Clarification' 
                      ? 'Please document what clarifications are needed before approval...' 
                      : 'Add an optional audit comment...'
                  }
                  className="w-full p-3.5 bg-slate-50 border border-slate-100 hover:bg-slate-100 focus:bg-white text-xs font-bold text-slate-800 rounded-2xl outline-none transition resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold rounded-xl transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl shadow-lg shadow-orange-600/10 transition text-xs flex items-center space-x-1.5"
                >
                  {submitting && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                  <span>Submit Action</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
