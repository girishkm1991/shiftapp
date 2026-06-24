import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { MessageSquare, Send, Paperclip, ChevronRight, RefreshCw, UserPlus, FileText, ArrowLeft, X } from 'lucide-react';
import { io } from 'socket.io-client';

interface ChatSystemProps {
  user: User;
  token: string;
}

export default function ChatSystem({ user, token }: ChatSystemProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);

  // New Chat Modal states
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState('');

  // File Upload state
  const [uploading, setUploading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChats = async (selectId?: string) => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch conversations list
      const res = await fetch('/api/chats', { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setConversations(data);
        if (selectId) {
          const found = data.find(c => c.id === selectId);
          if (found) setActiveConv(found);
        } else if (data.length > 0 && !activeConv) {
          setActiveConv(data[0]);
        }
      }

      // 2. Fetch employees for starting a new chat
      const resAssets = await fetch('/api/assets', { headers });
      const dataAssets = await resAssets.json();
      if (dataAssets && dataAssets.users) {
        setEmployees(dataAssets.users.filter((u: any) => u.id !== user.id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/chats/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [token]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id);

      // Connect to Socket.IO for real-time messages
      const socket = io();

      // Join the specific conversation room
      socket.emit('join_conversation', activeConv.id);

      // Listen for instant real-time messages
      socket.on('message', (newMsg: any) => {
        console.log('[Socket] Live message received:', newMsg);
        if (newMsg.conversationId === activeConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      });

      // Maintain a larger interval background sync fallback
      const interval = setInterval(() => {
        fetchMessages(activeConv.id);
      }, 8000);

      return () => {
        socket.disconnect();
        clearInterval(interval);
      };
    }
  }, [activeConv]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !attachedFile) return;

    try {
      const textToSend = messageText.trim();
      const payload: any = { text: textToSend };
      if (attachedFile) {
        payload.attachmentUrl = attachedFile.url;
        payload.attachmentName = attachedFile.name;
      }

      const res = await fetch(`/api/chats/${activeConv.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const newMsg = await res.json();
      setMessages([...messages, newMsg]);
      setMessageText('');
      setAttachedFile(null);
      fetchChats(activeConv.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartDirectChat = async () => {
    if (!selectedEmp) return;
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: selectedEmp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowNewChatModal(false);
      setSelectedEmp('');
      // Select the new chat
      setActiveConv(data);
      fetchChats(data.id);
    } catch (err: any) {
      alert(err.message || 'Failed to start chat');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    // Simulate high-fidelity asset file upload saving to dynamic URI mock
    setTimeout(() => {
      setAttachedFile({
        name: file.name,
        url: `/uploads/${file.name}`
      });
      setUploading(false);
    }, 1200);
  };

  const getRecipientName = (conv: any) => {
    if (conv.type === 'swap_discussion') return conv.title;
    const recipient = conv.participants?.find((p: any) => p.id !== user.id);
    return recipient ? recipient.name : 'Unknown Employee';
  };

  const getRecipientClockId = (conv: any) => {
    if (conv.type === 'swap_discussion') return 'Trade Discussion';
    const recipient = conv.participants?.find((p: any) => p.id !== user.id);
    return recipient ? recipient.clockId : 'EMP';
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3 h-[600px]">
      
      {/* 1. Conversations List Side Panel */}
      <div className={`md:border-r border-slate-200 flex flex-col justify-between ${activeConv ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h4 className="font-black text-slate-900 text-base">Chats & Discussions</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Direct messages & Trade discussions</p>
          </div>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="bg-orange-50 hover:bg-orange-100 p-2.5 rounded-xl text-orange-600 transition"
            title="Start new direct chat"
          >
            <UserPlus className="h-5 w-5" />
          </button>
        </div>

        {loading && conversations.length === 0 ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-orange-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.map(c => {
              const isActive = activeConv?.id === c.id;
              const hasUnread = false; // Mock simple read status
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveConv(c)}
                  className={`w-full p-4 text-left flex justify-between items-center transition-all ${isActive ? 'bg-orange-50/75 border-l-4 border-orange-600' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex justify-between items-baseline">
                      <h5 className="font-bold text-slate-800 text-sm truncate">{getRecipientName(c)}</h5>
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                        {c.latestMessage ? new Date(c.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xxs text-orange-600 font-bold uppercase mt-0.5">{getRecipientClockId(c)}</p>
                    <p className="text-xs text-slate-500 font-medium truncate mt-1">
                      {c.latestMessage ? c.latestMessage.text : 'No messages yet...'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Message Conversation Pane */}
      <div className={`md:col-span-2 flex flex-col justify-between bg-slate-50/50 ${!activeConv ? 'hidden md:flex justify-center items-center p-8 text-center' : 'flex'}`}>
        {activeConv ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 bg-white border-b border-slate-100 flex items-center space-x-3 shadow-sm shrink-0">
              <button
                onClick={() => setActiveConv(null)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-full text-slate-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h5 className="font-black text-slate-900 text-sm">{getRecipientName(activeConv)}</h5>
                <span className="text-xxs font-bold text-orange-600 uppercase">
                  {getRecipientClockId(activeConv)}
                </span>
              </div>
            </div>

            {/* Conversation messages listing body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {messages.map(m => {
                const isOwn = m.senderId === user.id;
                return (
                  <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${isOwn ? 'bg-orange-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200/60 rounded-tl-none'}`}>
                      <span className="block text-[10px] font-black opacity-75 uppercase mb-1">
                        {m.senderName}
                      </span>
                      <p className="text-sm font-semibold leading-relaxed break-words">{m.text}</p>
                      
                      {m.attachmentName && (
                        <div className={`mt-2.5 p-2 rounded-xl flex items-center space-x-2 border text-xs font-bold ${isOwn ? 'bg-orange-700/50 border-orange-500' : 'bg-slate-50 border-slate-200'}`}>
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate flex-1">{m.attachmentName}</span>
                          <span className="text-[10px] opacity-75">File Attached</span>
                        </div>
                      )}

                      <span className="block text-[9px] text-right mt-1.5 opacity-60 font-medium">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment preview if selected */}
            {attachedFile && (
              <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-800">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{attachedFile.name}</span>
                </div>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="text-xs font-black text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Bottom input text box */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex items-center space-x-2 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-slate-100 hover:bg-slate-200 p-3 rounded-full text-slate-600 transition shrink-0 active:scale-95 disabled:opacity-50"
                title="Attach Document or Certificate"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              <input
                type="text"
                placeholder={uploading ? 'Attaching file...' : 'Type a message...'}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={uploading}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />

              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 p-3 rounded-full text-white transition shrink-0 shadow shadow-orange-600/20 active:scale-95"
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-orange-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-orange-600 shadow-inner">
              <MessageSquare className="h-8 w-8" />
            </div>
            <div>
              <h4 className="font-black text-slate-800">Select a Conversation</h4>
              <p className="text-sm text-slate-400 font-semibold mt-1 max-w-sm mx-auto">
                Communicate directly with pilot employees or coordinate shift coverage details.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* --- NEW CHAT SELECTION MODAL --- */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-orange-600 text-white p-5 flex justify-between items-center">
              <div>
                <h4 className="text-lg font-black">Start Direct Conversation</h4>
                <p className="text-xs opacity-90">Select a fellow worker to start messaging</p>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="hover:bg-orange-700/60 p-2 rounded-full transition text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400">Select Employee (Pilot Segment)</label>
                <select
                  value={selectedEmp}
                  onChange={(e) => setSelectedEmp(e.target.value)}
                  className="mt-2 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.clockId})</option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleStartDirectChat}
                  disabled={!selectedEmp}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-xl transition shadow active:scale-95 disabled:opacity-50"
                >
                  Start Chatting
                </button>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-5 py-3 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
