import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Shield, Bell, MessageSquare, Send, CheckCircle, Info, Copy, RefreshCw, AlertTriangle, ExternalLink, Trash2 } from 'lucide-react';

interface ProfileSettingsProps {
  user: User;
  token: string;
  onUpdateUser: (updatedUser: User) => void;
}

export default function ProfileSettings({ user, token, onUpdateUser }: ProfileSettingsProps) {
  const [inAppNotificationsEnabled, setInAppNotificationsEnabled] = useState(user.inAppNotificationsEnabled !== false);
  const [internalMessagesEnabled, setInternalMessagesEnabled] = useState(user.internalMessagesEnabled !== false);
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(user.telegramNotificationsEnabled === true);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Secure self-service Telegram linking state
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset linking states if user becomes connected
  useEffect(() => {
    if (user.telegramChatId) {
      setLinkCode(null);
      setExpiresAt(null);
    }
  }, [user.telegramChatId]);

  // Expiration countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    
    const calculateTimeLeft = () => {
      const difference = new Date(expiresAt).getTime() - Date.now();
      const seconds = Math.max(0, Math.floor(difference / 1000));
      setTimeLeft(seconds);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await fetch('/api/profile/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inAppNotificationsEnabled,
          internalMessagesEnabled,
          telegramNotificationsEnabled,
          telegramChatId: user.telegramChatId || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      onUpdateUser(data.user);
      localStorage.setItem('imvelo_user', JSON.stringify(data.user));

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateLink = async () => {
    setGeneratingCode(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/profile/telegram/generate-link', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate link code');
      setLinkCode(data.linkCode);
      setExpiresAt(data.expiresAt);
    } catch (err: any) {
      setError(err.message || 'Error generating secure linking code.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to disconnect your Telegram account? You will stop receiving real-time shift alerts.')) {
      return;
    }
    setUnlinking(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/telegram/unlink', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlink account');
      
      onUpdateUser(data.user);
      localStorage.setItem('imvelo_user', JSON.stringify(data.user));
    } catch (err: any) {
      setError(err.message || 'Error disconnecting Telegram.');
    } finally {
      setUnlinking(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      // Call standard notifications preference API with matching payload to reload user data
      const res = await fetch('/api/profile/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inAppNotificationsEnabled,
          internalMessagesEnabled,
          telegramNotificationsEnabled,
          telegramChatId: user.telegramChatId || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to refresh connection');

      onUpdateUser(data.user);
      localStorage.setItem('imvelo_user', JSON.stringify(data.user));

      if (data.user.telegramChatId) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Refresh check failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(linkCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="profile-settings-page">
      {/* Page Title & Hero */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="h-7 w-7 text-orange-600" />
          Profile Settings
        </h2>
        <p className="text-slate-500 font-semibold text-sm mt-1 max-w-2xl">
          Customize your shift alert delivery channels. Imvelo Shift supports unified in-app popups, system chats, and secure Telegram delivery.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-slate-800 mb-2">Notification Channels</h3>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Channel 1: In-App */}
            <div className="flex items-start justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/55">
              <div className="flex gap-3">
                <div className="bg-orange-100 p-2.5 rounded-xl text-orange-600 self-start">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">In-App Banner Notifications</h4>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5 leading-relaxed">
                    Trigger real-time alert badge increments and toast popups across the system.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1.5 shrink-0">
                <input
                  type="checkbox"
                  checked={inAppNotificationsEnabled}
                  onChange={(e) => setInAppNotificationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>

            {/* Channel 2: Internal Message Box */}
            <div className="flex items-start justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/55">
              <div className="flex gap-3">
                <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 self-start">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">Internal Messages Module</h4>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5 leading-relaxed">
                    Automatically write official, read-only system messages inside your Chat Module.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1.5 shrink-0">
                <input
                  type="checkbox"
                  checked={internalMessagesEnabled}
                  onChange={(e) => setInternalMessagesEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>

            {/* Channel 3: Telegram Bot */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="bg-sky-100 p-2.5 rounded-xl text-sky-600 self-start">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">Telegram Bot Notifications</h4>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5 leading-relaxed">
                      Deliver instant notifications and swap alerts directly to your private Telegram messenger.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={telegramNotificationsEnabled}
                    onChange={(e) => setTelegramNotificationsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {telegramNotificationsEnabled && (
                <div className="pt-3 border-t border-slate-200/50 space-y-3 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[11px] font-black uppercase text-slate-400 block leading-none mb-1">Telegram Connection</span>
                      {user.telegramChatId ? (
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          <span>🟢 Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-500">
                          <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                          <span>🔴 Not Connected</span>
                        </div>
                      )}
                    </div>

                    {user.telegramChatId && (
                      <button
                        type="button"
                        onClick={handleUnlink}
                        disabled={unlinking}
                        className="text-rose-600 hover:bg-rose-50 p-2.5 rounded-xl border border-rose-100 flex items-center gap-1.5 text-xs font-black transition disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Disconnect
                      </button>
                    )}
                  </div>

                  {user.telegramChatId ? (
                    <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Username</span>
                        <span className="font-extrabold text-slate-800">{user.telegramUsername || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Chat ID</span>
                        <span className="font-mono font-extrabold text-slate-700">{user.telegramChatId}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!linkCode ? (
                        <button
                          type="button"
                          onClick={handleGenerateLink}
                          disabled={generatingCode}
                          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition active:scale-[0.99] disabled:opacity-50"
                        >
                          <Send className="h-4 w-4 shrink-0" />
                          {generatingCode ? 'Generating Code...' : 'Link Telegram Account'}
                        </button>
                      ) : (
                        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-black text-sky-950">Secure Linking Code</h4>
                              <p className="text-[11px] text-sky-700 font-semibold mt-0.5">Valid for 15 minutes • Single-use</p>
                            </div>
                            {timeLeft > 0 ? (
                              <div className="bg-sky-200/60 px-2 py-1 rounded-lg text-[11px] font-black text-sky-900 flex items-center gap-1 shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-pulse"></span>
                                <span>{formatTimeLeft(timeLeft)}</span>
                              </div>
                            ) : (
                              <div className="bg-rose-100 px-2 py-1 rounded-lg text-[11px] font-black text-rose-800 flex items-center gap-1 shrink-0">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>Expired</span>
                              </div>
                            )}
                          </div>

                          {timeLeft > 0 ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-sky-100">
                                <span className="font-mono font-black text-sm text-sky-950 tracking-wider select-all grow text-center">{linkCode}</span>
                                <button
                                  type="button"
                                  onClick={handleCopyToClipboard}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition shrink-0"
                                  title="Copy code"
                                >
                                  {copied ? <span className="text-xs font-black text-emerald-600">Copied!</span> : <Copy className="h-4 w-4" />}
                                </button>
                              </div>

                              <a
                                href={`https://t.me/imvelo_shift_bot?start=${linkCode}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition active:scale-[0.98]"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open in Telegram
                              </a>

                              <div className="text-[11px] text-sky-900/80 font-semibold space-y-1 bg-sky-100/45 p-3 rounded-xl">
                                <p><strong>How to link:</strong></p>
                                <p>1. Click "Open in Telegram" to start the conversation.</p>
                                <p>2. Send the pre-filled command OR copy and send this message: <code>/link {linkCode}</code></p>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleManualRefresh}
                                  disabled={refreshing}
                                  className="grow bg-white border border-sky-200 text-sky-800 hover:bg-sky-100/30 font-extrabold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs transition"
                                >
                                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                                  Check Connection Status
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-rose-700 font-bold">The linking code has expired. Please generate a new one.</p>
                              <button
                                type="button"
                                onClick={handleGenerateLink}
                                disabled={generatingCode}
                                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition"
                              >
                                Generate New Code
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Success and Error Indicators */}
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Profile preferences updated successfully!</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-sm font-bold">
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3.5 px-6 rounded-2xl transition shadow shadow-orange-600/10 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Saving Preferences...' : 'Save Preferences'}
            </button>
          </form>
        </div>

        {/* Telegram Instruction Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-sky-600" />
              Telegram Bot Link Guide
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-4">
              Connecting your Telegram account is simple, fast, and 100% secure. Follow these steps:
            </p>

            <ol className="space-y-4 text-xs font-bold text-slate-700">
              <li className="flex gap-3">
                <span className="bg-slate-100 text-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="text-slate-800">Generate Code</p>
                  <p className="text-xxs text-slate-400 font-semibold mt-0.5">Enable "Telegram Bot Notifications" on the left and click <strong className="text-slate-600">Link Telegram Account</strong>.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="bg-slate-100 text-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="text-slate-800">Start the Bot</p>
                  <p className="text-xxs text-slate-400 font-semibold mt-0.5">Click <strong className="text-slate-600">Open in Telegram</strong> to open our bot, <strong className="text-slate-600">@imvelo_shift_bot</strong>.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="bg-slate-100 text-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">3</span>
                <div>
                  <p className="text-slate-800">Send Linking Command</p>
                  <p className="text-xxs text-slate-400 font-semibold mt-0.5">The bot will open with a pre-filled command. Just hit "Send" to complete the linking!</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Status:</span>
              {user.telegramChatId ? (
                <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  Connected ✓
                </span>
              ) : (
                <span className="text-rose-500 font-extrabold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block animate-pulse"></span>
                  Not Linked ✗
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
