import React, { useState, useEffect } from 'react';
import { User, Department, Section, Machine } from '../types';
import { Shield, Key, UserCheck, Phone, Mail, Award, Calendar, ChevronRight, Lock } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Login states
  const [clockId, setClockId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Onboarding Wizard states
  const [tempUser, setTempUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Onboarding Step 1 state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Onboarding Step 2 states
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('dep1');
  const [sect, setSect] = useState('sec1');
  const [machine, setMachine] = useState('m1');

  // Metadata assets loaded from server
  const [assets, setAssets] = useState<{
    departments: Department[];
    sections: Section[];
    machines: Machine[];
  }>({ departments: [], sections: [], machines: [] });

  // Onboarding Step 3 default pattern state
  // 0: Sun, 1: Mon, ..., 6: Sat
  const [pattern, setPattern] = useState<('A' | 'B' | 'C' | 'OFF')[]>([
    'OFF', 'A', 'A', 'A', 'A', 'A', 'OFF' // Default: Sat-Sun Off, Mon-Fri Morning
  ]);

  useEffect(() => {
    // If there is a cached token, we can check it
    const savedToken = localStorage.getItem('imvelo_token');
    const savedUser = localStorage.getItem('imvelo_user');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.status === 'active') {
          onLoginSuccess(savedToken, parsed);
        } else {
          // Continue onboarding
          setToken(savedToken);
          setTempUser(parsed);
          if (parsed.status === 'onboarding_step1') setStep(1);
          else if (parsed.status === 'onboarding_step2') setStep(2);
          else if (parsed.status === 'onboarding_step3') setStep(3);
        }
      } catch (e) {
        localStorage.clear();
      }
    }
  }, []);

  // Fetch asset metadata for onboarding dropdowns
  const fetchAssets = async (authToken: string) => {
    try {
      const res = await fetch('/api/assets', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data) setAssets(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockId.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clockId, password, rememberMe })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setToken(data.token);
      if (rememberMe && data.user.status === 'active') {
        localStorage.setItem('imvelo_token', data.token);
        localStorage.setItem('imvelo_user', JSON.stringify(data.user));
      }

      if (data.user.status === 'active') {
        onLoginSuccess(data.token, data.user);
      } else {
        setTempUser(data.user);
        await fetchAssets(data.token);
        if (data.user.status === 'onboarding_step1') setStep(1);
        else if (data.user.status === 'onboarding_step2') setStep(2);
        else if (data.user.status === 'onboarding_step3') setStep(3);
      }
    } catch (err: any) {
      setError(err.message || 'Connection error. Try password123');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/onboard/step1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTempUser(data.user);
      setStep(2);
      await fetchAssets(token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !dept || !sect || !machine) {
      setError('Please fill in all mandatory fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/onboard/step2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mobile,
          email,
          departmentId: dept,
          sectionId: sect,
          machineId: machine
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTempUser(data.user);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/onboard/step3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pattern })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Save complete session
      localStorage.setItem('imvelo_token', token);
      localStorage.setItem('imvelo_user', JSON.stringify(data.user));
      onLoginSuccess(token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render Login Screen
  if (!tempUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="bg-orange-600 p-3 rounded-2xl shadow-lg shadow-orange-600/20 text-white">
              <Shield className="h-10 w-10 animate-pulse" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Imvelo Shift
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Builders Section Pilot • <span className="font-semibold text-orange-600">Apollo Tyres</span>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Clock ID (e.g., EMP001, SUP901)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    required
                    value={clockId}
                    onChange={(e) => setClockId(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 placeholder-slate-400 font-medium transition duration-150"
                    placeholder="EMP001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 placeholder-slate-400 transition duration-150"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-slate-300 rounded-md transition duration-150"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-600">
                    Keep me logged in
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-base font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition duration-150 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              Need assistance? Clock ID is printed on your physical factory badge. Pilot default password is <span className="font-semibold text-slate-600">password123</span>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Onboarding Flow
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full mx-auto bg-white shadow-xl rounded-2xl border border-slate-100 overflow-hidden">
        {/* Header indicator */}
        <div className="bg-orange-600 p-6 text-white text-center">
          <h2 className="text-2xl font-bold">Employee Setup Wizard</h2>
          <p className="text-sm opacity-90 mt-1">Hello {tempUser.name}, complete these 3 simple steps to begin swapping shifts!</p>
          
          {/* Timeline steps dots */}
          <div className="flex items-center justify-center mt-6 space-x-4">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-white' : 'text-orange-300'}`}>
              <span className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${step === 1 ? 'bg-white text-orange-600 border-white' : 'border-orange-300'}`}>1</span>
              <span className="text-xs font-semibold hidden sm:inline">Credentials</span>
            </div>
            <div className="h-0.5 w-8 bg-orange-400"></div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-white' : 'text-orange-300'}`}>
              <span className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${step === 2 ? 'bg-white text-orange-600 border-white' : 'border-orange-300'}`}>2</span>
              <span className="text-xs font-semibold hidden sm:inline">Profile</span>
            </div>
            <div className="h-0.5 w-8 bg-orange-400"></div>
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-white' : 'text-orange-300'}`}>
              <span className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${step === 3 ? 'bg-white text-orange-600 border-white' : 'border-orange-300'}`}>3</span>
              <span className="text-xs font-semibold hidden sm:inline">Schedule</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* STEP 1: Mandatory Password change */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <Key className="h-6 w-6 text-orange-600" />
                <h3 className="text-lg font-bold text-slate-900">Change Your Temporary Password</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Security Policy requires changing your default temporary password on first login to protect your shift trading account.
              </p>

              <div>
                <label className="block text-sm font-semibold text-slate-700">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 placeholder-slate-400 font-medium transition"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 placeholder-slate-400 font-medium transition"
                  placeholder="Re-enter password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md font-semibold transition active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Updating Password...' : 'Save and Continue'}
                <ChevronRight className="ml-2 h-5 w-5" />
              </button>
            </form>
          )}

          {/* STEP 2: Profile details */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-6">
              <div className="flex items-center space-x-3 mb-4">
                <UserCheck className="h-6 w-6 text-orange-600" />
                <h3 className="text-lg font-bold text-slate-900">Configure Work Profile</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Mobile Number (WhatsApp Enabled)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <Phone className="absolute top-3.5 left-3 h-5 w-5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 placeholder-slate-400 font-medium transition"
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Email Address (Optional)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <Mail className="absolute top-3.5 left-3 h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-900 placeholder-slate-400 font-medium transition"
                      placeholder="user@apollotyres.com"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Department</label>
                <select
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                >
                  {assets.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Section</label>
                <select
                  value={sect}
                  onChange={(e) => setSect(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                >
                  {assets.sections.filter(s => s.departmentId === dept).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Primary Assigned Machine / Work Area</label>
                <select
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                >
                  {assets.machines.filter(m => m.sectionId === sect).map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md font-semibold transition active:scale-95 disabled:opacity-50"
              >
                Save and Continue
                <ChevronRight className="ml-2 h-5 w-5" />
              </button>
            </form>
          )}

          {/* STEP 3: Default Weekly Shift Pattern */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-2">
                <Calendar className="h-6 w-6 text-orange-600" />
                <h3 className="text-lg font-bold text-slate-900">Define Weekly Default Shifts</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Configure your typical schedule. This enables our Intelligent Eligibility Engine to recommend matching swaps and helps supervisors plan workforce resources.
              </p>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                  <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-200 last:border-none">
                    <span className="text-sm font-bold text-slate-700 mb-1.5 sm:mb-0">{day}</span>
                    <div className="flex bg-slate-200/60 p-1 rounded-xl">
                      {[
                        { code: 'A', name: 'A (Morning)' },
                        { code: 'B', name: 'B (Noon)' },
                        { code: 'C', name: 'C (Night)' },
                        { code: 'OFF', name: 'OFF' }
                      ].map(opt => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => {
                            const newPattern = [...pattern];
                            newPattern[idx] = opt.code as any;
                            setPattern(newPattern);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${pattern[idx] === opt.code ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                          {opt.code}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleStep3}
                disabled={loading}
                className="w-full flex items-center justify-center py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md font-bold text-base transition active:scale-95 disabled:opacity-50"
              >
                Complete Onboarding & Start
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
