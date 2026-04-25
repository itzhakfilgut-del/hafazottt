import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, updateDoc, doc, where, or } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { X, Send, MessageCircle, Reply, Check, CheckCheck, Users, Search, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  timestamp: string;
  replyTo?: {
    id: string;
    text: string;
    name: string;
  };
  readBy?: string[];
}

interface ChatPanelProps {
  onClose: () => void;
}

type ChatTab = 'global' | 'users' | 'private';

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const { appUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>('global');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Global Messages
  useEffect(() => {
    const q = query(
      collection(db, 'chat_messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({ id: docSnap.id, ...data } as ChatMessage);
        
        // Mark as read if it's not our message and we haven't read it
        if (data.uid !== appUser?.uid && (!data.readBy || !data.readBy.includes(appUser?.uid))) {
          if (activeTab === 'global') {
             updateDoc(docSnap.ref, {
               readBy: [...(data.readBy || []), appUser?.uid]
             }).catch(console.error);
          }
        }
      });
      setMessages(msgs.reverse());
    });

    return () => unsubscribe();
  }, [appUser?.uid, activeTab]);
  
  // Fetch Users List
  useEffect(() => {
    if (activeTab !== 'users') return;
    
    const usersQ = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      const fetchedUsers: AppUser[] = [];
      snapshot.forEach(docSnap => {
        const u = { ...docSnap.data(), uid: docSnap.id } as AppUser;
        if (u.uid !== appUser?.uid) {
           fetchedUsers.push(u);
        }
      });
      setUsers(fetchedUsers);
    });
    
    return () => unsubscribeUsers();
  }, [activeTab, appUser?.uid]);

  // Fetch Private Messages
  useEffect(() => {
    if (activeTab !== 'private' || !selectedUser || !appUser) return;
    
    // Create a deterministic chat channel ID between two users
    const channelId = [appUser.uid, selectedUser.uid].sort().join('_');

    const pmQ = query(
      collection(db, `private_chats/${channelId}/messages`),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(pmQ, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({ id: docSnap.id, ...data } as ChatMessage);
        
        // Mark as read
        if (data.uid !== appUser?.uid && (!data.readBy || !data.readBy.includes(appUser?.uid))) {
           updateDoc(docSnap.ref, {
             readBy: [...(data.readBy || []), appUser?.uid]
           }).catch(console.error);
        }
      });
      setPrivateMessages(msgs.reverse());
    });

    return () => unsubscribe();
  }, [activeTab, selectedUser, appUser]);

  useEffect(() => {
    if (activeTab === 'global') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'private') {
      privateMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, privateMessages, activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !appUser || isSending) return;
    
    const isGlobal = activeTab === 'global';
    
    // In global chat, check if user can reply
    if (isGlobal && canNotReply) return;

    setIsSending(true);
    try {
      const messageData: any = {
        uid: appUser.uid,
        name: appUser.name,
        text: newMessage.trim(),
        timestamp: new Date().toISOString(),
        readBy: []
      };

      if (replyToMessage) {
        messageData.replyTo = {
          id: replyToMessage.id,
          text: replyToMessage.text,
          name: replyToMessage.name
        };
      }

      if (isGlobal) {
        await addDoc(collection(db, 'chat_messages'), messageData);
      } else if (selectedUser) {
        const channelId = [appUser.uid, selectedUser.uid].sort().join('_');
        await addDoc(collection(db, `private_chats/${channelId}/messages`), messageData);
      }
      
      setNewMessage('');
      setReplyToMessage(null);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const startPrivateChat = (user: AppUser) => {
    setSelectedUser(user);
    setActiveTab('private');
    setReplyToMessage(null);
  };

  const lastMessage = messages[messages.length - 1];
  const canNotReply = activeTab === 'global' && appUser?.role !== 'admin' && lastMessage?.uid === appUser?.uid;
  
  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderMessageList = (msgList: ChatMessage[], isGlobal: boolean) => {
    if (msgList.length === 0) {
      return (
        <div className="text-center text-slate-400 mt-10">
          אין הודעות בשיחה זו עדיין...
        </div>
      );
    }

    return msgList.map((msg, index) => {
      const isMe = msg.uid === appUser?.uid;
      // Group messages from same user if consecutive within 5 mins
      const prevMsg = msgList[index - 1];
      const isConsecutive = prevMsg && prevMsg.uid === msg.uid && !msg.replyTo &&
        (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 5 * 60000);

      const isRead = msg.readBy && msg.readBy.length > 0;

      return (
        <div key={msg.id} className={cn("flex flex-col group", isMe ? "items-start" : "items-end")}>
          {!isMe && !isConsecutive && (
            <span className="text-xs text-slate-500 mb-1 px-1">{msg.name}</span>
          )}
          
          <div className={cn("flex flex-col relative", isMe ? "items-start" : "items-end")}>
            <div className={cn("flex items-center gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
              
              <div 
                className={cn(
                  "px-4 py-2 max-w-[240px] sm:max-w-xs break-words shadow-sm relative group",
                  isMe 
                    ? "bg-primary text-white rounded-2xl rounded-tr-sm" 
                    : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm",
                  msg.replyTo ? "mt-6" : ""
                )}
              >
                {msg.replyTo && (
                  <div className={cn(
                    "absolute -top-6 text-xs truncate max-w-full px-2 py-1 rounded-t-lg opacity-80",
                    isMe ? "bg-primary/80 right-0 left-4" : "bg-slate-200 left-0 right-4"
                  )}>
                    <span className="font-semibold block truncate">{msg.replyTo.name}</span>
                    <span className="truncate block">{msg.replyTo.text}</span>
                  </div>
                )}
                
                {msg.text}
                
                <div className={cn(
                  "text-[10px] mt-1 flex items-center justify-end gap-1 opacity-70",
                  isMe ? "text-blue-100" : "text-slate-500"
                )}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  {isMe && (
                    isRead ? <CheckCheck size={12} className="text-white" /> : <Check size={12} />
                  )}
                </div>
              </div>
              
              {/* Reply Button (shows on hover) */}
              <button 
                onClick={() => setReplyToMessage(msg)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-primary bg-slate-100 hover:bg-slate-200 rounded-full transition-all"
                title="הגב"
              >
                <Reply size={14} />
              </button>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">
      
      {/* Header */}
      <div className="flex flex-col border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {activeTab === 'private' && (
              <button 
                onClick={() => setActiveTab('users')}
                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
              >
                <ArrowRight size={18} />
              </button>
            )}
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              {activeTab === 'global' && <><MessageCircle size={20} className="text-primary" /> צ'אט קבוצתי</>}
              {activeTab === 'users' && <><Users size={20} className="text-primary" /> רשימת משתמשים</>}
              {activeTab === 'private' && selectedUser && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                    {selectedUser.name.charAt(0)}
                  </div>
                  <span className="truncate max-w-[150px]">{selectedUser.name}</span>
                </div>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Navigation Tabs */}
        {activeTab !== 'private' && (
          <div className="flex border-t border-slate-100 px-2 pb-1">
            <button 
              onClick={() => setActiveTab('global')}
              className={cn(
                "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'global' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              קבוצתי
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'users' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              הודעה פרטית
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
        
        {/* Global Chat */}
        {activeTab === 'global' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {renderMessageList(messages, true)}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Users List */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="חיפוש משתמש..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            
            <div className="space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  לא נמצאו משתמשים.
                </div>
              ) : (
                filteredUsers.map(user => {
                  // Determine if active recently (simulated based on clicks/lastLocation if we wanted, or just status).
                  // Currently we don't have a reliable 'online' status, so we'll just show the user.
                  // We can add a green dot if their role is admin or they have recent activity in a real app.
                  const isRecentlyActive = user.clicks > 0; // rough simulation
                  
                  return (
                    <button
                      key={user.uid}
                      onClick={() => startPrivateChat(user)}
                      className="w-full flex items-center gap-3 p-3 bg-white border border-slate-100 hover:border-primary/30 hover:bg-primary/5 rounded-xl transition-all text-right"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold">
                          {user.name.charAt(0)}
                        </div>
                        {isRecentlyActive && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="font-medium text-slate-900 truncate">{user.name}</div>
                        <div className="text-xs text-slate-500 truncate">{user.yeshiva}</div>
                      </div>
                      <MessageCircle size={16} className="text-slate-300" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
        
        {/* Private Chat */}
        {activeTab === 'private' && selectedUser && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {renderMessageList(privateMessages, false)}
            <div ref={privateMessagesEndRef} />
          </div>
        )}

      </div>

      {/* Input Area (Only for chats) */}
      {(activeTab === 'global' || activeTab === 'private') && (
        <div className="p-3 bg-white border-t border-slate-100 flex flex-col gap-2 relative">
          
          {replyToMessage && (
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <Reply size={14} className="text-primary shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-primary ml-1">{replyToMessage.name}:</span>
                  <span className="text-slate-600 truncate">{replyToMessage.text}</span>
                </div>
              </div>
              <button 
                onClick={() => setReplyToMessage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="relative flex-1">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={(activeTab === 'global' && canNotReply) || isSending}
              placeholder={
                activeTab === 'global' && canNotReply 
                  ? "המתן לתגובה כדי להמשיך לכתוב..." 
                  : "הקלד הודעה..."
              }
              className={cn(
                "w-full pl-12 pr-4 py-3 rounded-xl border focus:ring-2 focus:outline-none transition-all",
                (activeTab === 'global' && canNotReply)
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-50 border-slate-200 focus:ring-primary/20 focus:border-primary focus:bg-white"
              )}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || (activeTab === 'global' && canNotReply) || isSending}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Send size={20} className="rotate-180" />
            </button>
          </form>
          {activeTab === 'global' && canNotReply && (
            <p className="text-xs text-orange-500 mt-1 text-center">
              ניתן לשלוח רק הודעה אחת ברצף.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
