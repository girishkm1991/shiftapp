import React, { useState } from 'react';
import { User } from '../types';
import { Shield, Bell, MessageSquare, Send, CheckCircle, Info } from 'lucide-react';

interface ProfileSettingsProps {
  user: User;
  token: string;
  onUpdateUser: (updatedUser: User) => void;
}

export default function ProfileSettings({ user, token, onUpdateUser }: ProfileSettingsProps) {
  const [inAppNotificationsEnabled, setInAppNotificationsEnabled] = useState(user.inAppNotificationsEnabled !== false);
  const [internalMessagesEnabled, setInternalMessagesEnabled] = useState(user.internalMessagesEnabled !== false);
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(user.telegramNotificationsEnabled === true);
  const [telegramChatId, setTelegramChatId] = useState(user.telegramChatId || '');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          telegramChatId: telegramChatId.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      // Update parent user state & local storage
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
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg font-black text-slate-800 mb-6">Notification Channels</h3>

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
              <label className="relative inline-flex items-center cursor-pointer mt-1.5">
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
              <label className="relative inline-flex items-center cursor-pointer mt-1.5">
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
                <label className="relative inline-flex items-center cursor-pointer mt-1.5">
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
                <div className="pt-3 border-t border-slate-200/50 space-y-2 animate-in slide-in-from-top-2 duration-150">
                  <label className="block text-xs font-black uppercase text-slate-500">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="Enter your Telegram Chat ID (e.g. 123456789)"
                    className="block w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              )}
            </div>

            {/* Success and Error Indicators */}
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Profile notification channels updated successfully!</span>
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
              {saving ? 'Saving Settings...' : 'Save Preferences'}
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
              To link your Imvelo Shift account and receive secure shift notifications in your Telegram, follow these simple setup instructions:
            </p>

            <ol className="space-y-4 text-xs font-bold text-slate-700">
              <li className="flex gap-3">
                <span className="bg-slate-100 text-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="text-slate-800">Search for Bot</p>
                  <p className="text-xxs text-slate-400 font-semibold mt-0.5">Open Telegram and search for: <strong className="text-slate-600">@imvelo_shift_bot</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="bg-slate-100 text-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="text-slate-800">Activate Connection</p>
                  <p className="text-xxs text-slate-400 font-semibold mt-0.5">Click "Start" or send the text <strong className="text-slate-600">/start</strong> to the bot.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="bg-slate-100 text-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">3</span>
                <div>
                  <p className="text-slate-800">Obtain Chat ID</p>
                  <p className="text-xxs text-slate-400 font-semibold mt-0.5">The bot will reply instantly with your private, secure numerical Chat ID.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="bg-slate-100 text-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">4</span>
                <div>
                  <p className="text-slate-800">Input and Save</p>
                  <p className="text-xxs text-slate-400 font-semibold mt-0.5">Copy that number, paste it into the "Telegram Chat ID" field, and click "Save Preferences".</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Status:</span>
              {user.telegramChatId ? (
                <span className="text-emerald-600">Linked ✓</span>
              ) : (
                <span className="text-rose-500">Not Linked ✗</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
