import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getBaseUrl } from '../lib/session';
import { io, Socket } from 'socket.io-client';
import { 
  Send, MessageSquare, Clock, 
  RefreshCw, Paperclip, X, FileText, Download 
} from 'lucide-react';
import { safeFormatTime } from '../lib/dateUtils';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderDepartment: string;
  recipientId: string | null;
  message: string;
  timestamp: string;
  fileName: string | null;
  hasFile?: number;
  fileData?: string | null;
}

export default function Chat() {
  const { session, updatePresence } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; type: string; data: string } | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update presence status on navigation
  useEffect(() => {
    updatePresence('Chat Desk', 'ONLINE');
  }, [updatePresence]);

  // Connect Socket.io
  useEffect(() => {
    const baseUrl = getBaseUrl();
    const socket = io(baseUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[CHAT SOCKET] Connected to real-time events');
    });

    socket.on('receive_chat_message', (msg: ChatMessage) => {
      if (!msg.recipientId) {
        setMessages(prev => {
          if (prev.some(p => p.id === msg.id)) return prev;
          return [...prev, msg].slice(-500);
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch history capped to max 500 messages
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/chat/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        }
      });
      const json = await res.json();
      if (json.data) {
        setMessages(json.data.slice(-500));
      }
    } catch (err) {
      console.error('[CHAT] History fetch failed:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Auto-scroll messages to bottom (isolated to timeline scroll element)
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("Attachment limit is 3MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type,
        data: reader.result as string
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && !attachment) || !session || !socketRef.current) return;

    const payload = {
      senderId: session.userId,
      senderName: session.userName,
      senderDepartment: session.department,
      recipientId: null,
      message: messageText.trim(),
      fileName: attachment ? attachment.name : null,
      fileData: attachment ? attachment.data : null
    };

    socketRef.current.emit('send_chat_message', payload);
    setMessageText('');
    setAttachment(null);
  };

  const downloadFile = async (msgId: string, name: string) => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/chat/file/${msgId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nk_token') || ''}`
        }
      });
      if (!res.ok) throw new Error('File download failed');
      const json = await res.json();
      if (!json.fileData) throw new Error('File data is missing');
      
      const link = document.createElement('a');
      link.href = json.fileData;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to download attachment: ' + err.message);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#efeae2] dark:bg-slate-950">
      
      {/* WhatsApp Style Top Header Bar */}
      <div className="w-full bg-[#f0f2f5] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold shadow-inner">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm leading-tight">General Broadcast Channel</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Active Operators Desk</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadHistory} 
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-all"
            title="Reload Chat"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Message Timeline Area */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 min-h-0 bg-[#efeae2] dark:bg-slate-950">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full space-y-2 py-20">
            <RefreshCw size={24} className="text-[#00a884] animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div className="p-4 bg-[#e8e9eb] dark:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 mb-2">
              <MessageSquare size={24} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">No messages in this channel yet.</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Announcements will be visible to all clinic operators.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === session?.userId;
            const hasAttachment = msg.fileName && msg.fileData;

            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                {/* Bubble */}
                <div 
                  className={`max-w-[65%] rounded-lg px-3 py-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative ${
                    isOwn 
                      ? 'bg-[#d9fdd3] dark:bg-emerald-950 text-[#111b21] dark:text-emerald-100 rounded-tr-none border border-transparent dark:border-emerald-900/40' 
                      : 'bg-white dark:bg-slate-900 text-[#111b21] dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-800'
                  }`}
                >
                  {!isOwn && (
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      <span className="font-black text-[9px] text-[#008069] dark:text-emerald-400 uppercase tracking-wide">{msg.senderName}</span>
                      <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded">
                        {msg.senderDepartment}
                      </span>
                    </div>
                  )}
                  
                  {/* Message body */}
                  {msg.message && (
                    <p className="text-xs font-medium leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                  )}

                  {/* Render attachment */}
                  {msg.fileName && (
                    <div className={`mt-1.5 ${msg.message ? 'border-t pt-1.5 border-slate-200/40 dark:border-slate-700/40' : ''}`}>
                      <div className={`flex items-center justify-between p-2 rounded border text-xs gap-3 ${
                        isOwn ? 'bg-[#c7f4bd] dark:bg-emerald-900/60 border-emerald-200/20 text-[#111b21] dark:text-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={16} className="text-slate-550 dark:text-slate-400 shrink-0" />
                          <span className="truncate font-bold max-w-[140px]">{msg.fileName}</span>
                        </div>
                        <button 
                          onClick={() => downloadFile(msg.id, msg.fileName!)}
                          className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors"
                          title="Download attachment"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-slate-400 dark:text-slate-500 select-none">
                    <Clock size={8} className="opacity-60" />
                    <span>{safeFormatTime(msg.timestamp, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* WhatsApp Style Bottom Input Bar */}
      <div className="w-full bg-[#f0f2f5] dark:bg-slate-900 p-3 flex flex-col shrink-0 border-t border-slate-200 dark:border-slate-800 z-10 pb-safe">
        
        {/* Attachment preview box */}
        {attachment && (
          <div className="mb-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between gap-3 max-w-sm shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              {attachment.type.startsWith('image/') ? (
                <img src={attachment.data} className="w-9 h-9 rounded object-cover" alt="preview" />
              ) : (
                <div className="w-9 h-9 bg-slate-100 dark:bg-slate-900 rounded flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 shrink-0">
                  <FileText size={16} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">{attachment.name}</p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">{attachment.type || 'Document File'}</p>
              </div>
            </div>
            <button 
              onClick={() => setAttachment(null)} 
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center shrink-0"
            title="Attach Document/Photo"
          >
            <Paperclip size={18} />
          </button>

          <input
            type="text"
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg outline-none text-xs font-semibold focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
          />
          
          <button
            type="submit"
            disabled={!messageText.trim() && !attachment}
            className="p-2.5 bg-[#00a884] text-white rounded-full hover:bg-[#008f72] disabled:opacity-50 transition-all flex items-center justify-center shrink-0 shadow-md"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

    </div>
  );
}
