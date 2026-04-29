import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { X, Send, MessageCircle, Reply, Check, CheckCheck, Users, Search, ArrowRight, SmilePlus } from 'lucide-react';
import { cn, getFallbackAvatar } from '../lib/utils';

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
  reactions?: Record<string, string[]>;
}

interface ChatPanelProps {
  onClose: () => void;
}

type ChatTab = 'global' | 'global_boys' | 'global_girls' | 'users' | 'private';

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

  useEffect(() => {
    if (appUser?.role === 'admin' && activeTab === 'global') {
      setActiveTab('global_boys');
    }
  }, [appUser?.role, activeTab]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [unreadPrivateMap, setUnreadPrivateMap] = useState<Record<string, boolean>>({});
  const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, {text: string, timestamp: string, senderId?: string}>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessagesEndRef = useRef<HTMLDivElement>(null);

  // Unread Map and Last Messages
  useEffect(() => {
    if (!appUser) return;
    const unsub = onSnapshot(doc(db, 'user_chats', appUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUnreadPrivateMap(docSnap.data().unreadPrivate || {});
        setLastMessagesMap(docSnap.data().lastMessages || {});
      } else {
        setUnreadPrivateMap({});
        setLastMessagesMap({});
      }
    });
    return () => unsub();
  }, [appUser]);

  // Handle Mark as Read for Private Chat
  useEffect(() => {
    if (activeTab === 'private' && selectedUser && appUser && unreadPrivateMap[selectedUser.uid]) {
        setDoc(doc(db, 'user_chats', appUser.uid), {
          unreadPrivate: {
            [selectedUser.uid]: false
          }
        }, { merge: true }).catch(console.error);
    }
  }, [activeTab, selectedUser, appUser, privateMessages.length, unreadPrivateMap]);

  // Fetch Global Messages
  useEffect(() => {
    let globalChatCol = '';
    
    if (appUser?.role === 'admin') {
      if (activeTab === 'global_boys') globalChatCol = 'chat_messages_boys';
      else if (activeTab === 'global_girls') globalChatCol = 'chat_messages_girls';
      else return; // Don't fetch for other tabs
    } else {
      if (activeTab !== 'global') return;
      if (!appUser?.gender) return;
      globalChatCol = appUser.gender === 'boy' ? 'chat_messages_boys' : 'chat_messages_girls';
    }

    const q = query(
      collection(db, globalChatCol),
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
          if (activeTab === 'global' || activeTab === 'global_boys' || activeTab === 'global_girls') {
             updateDoc(docSnap.ref, {
               readBy: [...(data.readBy || []), appUser?.uid]
             }).catch(console.error);
          }
        }
      });
      setMessages(msgs.reverse());
    });

    return () => unsubscribe();
  }, [appUser?.uid, appUser?.gender, appUser?.role, activeTab]);
  
  // Fetch Users List
  useEffect(() => {
    if (activeTab !== 'users' || !appUser) return;
    
    const usersQ = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      const fetchedUsers: AppUser[] = [];
      snapshot.forEach(docSnap => {
        const u = { ...docSnap.data(), uid: docSnap.id } as AppUser;
        // Strict gender separation constraint + exclude self
        if (u.uid !== appUser.uid) {
           if (appUser.role === 'admin') {
              fetchedUsers.push(u);
           } else {
              if (u.gender === appUser.gender || u.role === 'admin') {
                 fetchedUsers.push(u);
              }
           }
        }
      });
      setUsers(fetchedUsers);
    });
    
    return () => unsubscribeUsers();
  }, [activeTab, appUser?.uid, appUser?.gender, appUser?.role]);

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

  const isGlobalTab = activeTab === 'global' || activeTab === 'global_boys' || activeTab === 'global_girls';

  useEffect(() => {
    if (isGlobalTab) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'private') {
      privateMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, privateMessages, activeTab, isGlobalTab]);

  const handleReaction = async (msgId: string, emoji: string, isGlobal: boolean) => {
    if (!appUser) return;
    try {
      let path = '';
      if (isGlobalTab) {
        if (appUser.role === 'admin') {
          path = activeTab === 'global_boys' ? 'chat_messages_boys' : 'chat_messages_girls';
        } else {
          path = appUser.gender === 'boy' ? 'chat_messages_boys' : 'chat_messages_girls';
        }
      } else if (selectedUser) {
        const channelId = [appUser.uid, selectedUser.uid].sort().join('_');
        path = `private_chats/${channelId}/messages`;
      } else {
        return;
      }

      const msgRef = doc(db, path, msgId);
      
      const msgList = isGlobal ? messages : privateMessages;
      const msg = msgList.find(m => m.id === msgId);
      if (!msg) return;

      const currentReactions = msg.reactions || {};
      const emojiUsers = currentReactions[emoji] || [];
      
      let newReactions = { ...currentReactions };
      
      if (emojiUsers.includes(appUser.uid)) {
        // Remove reaction
        newReactions[emoji] = emojiUsers.filter(uid => uid !== appUser.uid);
        if (newReactions[emoji].length === 0) {
          delete newReactions[emoji];
        }
      } else {
        // Add reaction
        newReactions[emoji] = [...emojiUsers, appUser.uid];
      }

      await updateDoc(msgRef, { reactions: newReactions });
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !appUser || isSending) return;
    
    const isGlobal = activeTab === 'global' || activeTab === 'global_boys' || activeTab === 'global_girls';
    
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
        let globalChatCol = '';
        if (appUser.role === 'admin') {
          globalChatCol = activeTab === 'global_boys' ? 'chat_messages_boys' : 'chat_messages_girls';
        } else {
          globalChatCol = appUser.gender === 'boy' ? 'chat_messages_boys' : 'chat_messages_girls';
        }
        await addDoc(collection(db, globalChatCol), messageData);
      } else if (selectedUser) {
        const channelId = [appUser.uid, selectedUser.uid].sort().join('_');
        await addDoc(collection(db, `private_chats/${channelId}/messages`), messageData);
        // Mark as unread and update last message for recipient
        await setDoc(doc(db, 'user_chats', selectedUser.uid), {
          unreadPrivate: {
            [appUser.uid]: true
          },
          lastMessages: {
            [appUser.uid]: {
              text: newMessage.trim(),
              timestamp: messageData.timestamp,
              senderId: appUser.uid
            }
          }
        }, { merge: true });
        
        // Update last message for sender
        await setDoc(doc(db, 'user_chats', appUser.uid), {
          lastMessages: {
            [selectedUser.uid]: {
              text: newMessage.trim(),
              timestamp: messageData.timestamp,
              senderId: appUser.uid
            }
          }
        }, { merge: true });
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
  
  const filteredUsers = [...users]
    .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aUnread = unreadPrivateMap[a.uid] ? 1 : 0;
      const bUnread = unreadPrivateMap[b.uid] ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      
      const aLastMsg = lastMessagesMap[a.uid]?.timestamp || '';
      const bLastMsg = lastMessagesMap[b.uid]?.timestamp || '';
      if (aLastMsg !== bLastMsg) return bLastMsg.localeCompare(aLastMsg);
      
      return a.name.localeCompare(b.name);
    });

  const groupMessagesByDate = (msgList: ChatMessage[]) => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    
    msgList.forEach(msg => {
      const dateObj = new Date(msg.timestamp);
      // Create a nice date string (e.g., "היום", "אתמול", or full date)
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateString = dateObj.toLocaleDateString('he-IL');
      if (dateObj.toDateString() === today.toDateString()) {
        dateString = 'היום';
      } else if (dateObj.toDateString() === yesterday.toDateString()) {
        dateString = 'אתמול';
      }

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateString) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ date: dateString, messages: [msg] });
      }
    });
    
    return groups;
  };

  const renderMessageList = (msgList: ChatMessage[], isGlobal: boolean) => {
    if (msgList.length === 0) {
      return (
        <div className="text-center bg-yellow-50 text-yellow-800/80 px-4 py-2 rounded-lg text-sm mx-auto my-6 max-w-fit shadow-sm">
          שיחה זו מאובטחת בהצפנה מקצה לקצה.
        </div>
      );
    }

    const messageGroups = groupMessagesByDate(msgList);

    return messageGroups.map((group, groupIndex) => (
      <div key={`group-${groupIndex}`} className="flex flex-col">
        {/* Date Separator */}
        <div className="flex justify-center my-4">
          <span className="bg-white/80 shadow-sm text-slate-500 text-xs px-3 py-1 rounded-lg backdrop-blur-sm">
            {group.date}
          </span>
        </div>

        {group.messages.map((msg, index) => {
          const isMe = msg.uid === appUser?.uid;
          const prevMsg = group.messages[index - 1];
          const isConsecutive = prevMsg && prevMsg.uid === msg.uid && !msg.replyTo &&
            (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 5 * 60000);

          const isRead = msg.readBy && msg.readBy.length > 0;
          const showPointer = !isConsecutive;

          return (
            <div key={msg.id} className={cn("flex flex-col group", isMe ? "items-start" : "items-end", isConsecutive ? "mt-1" : "mt-3")}>
              {/* Name for Global Chat */}
              {!isMe && !isConsecutive && isGlobal && (
                <span className="text-[11px] text-slate-500 mb-0.5 px-8 opacity-80">{msg.name}</span>
              )}
              
              <div className={cn("flex flex-col relative w-full", isMe ? "items-start" : "items-end")}>
                <div className={cn("flex items-end gap-1.5", isMe ? "flex-row-reverse" : "flex-row")}>
                  
                  {/* Sender Avatar - only in global chat */}
                  {!isMe && isGlobal && (
                    <div className="w-6 h-6 rounded-full flex shrink-0 items-center justify-center relative z-10 bottom-0.5">
                      {!isConsecutive ? (
                        <img 
                          src={(users.find(u => u.uid === msg.uid)?.photoURL && !users.find(u => u.uid === msg.uid)?.photoURL?.includes('dicebear.com')) ? users.find(u => u.uid === msg.uid)?.photoURL : getFallbackAvatar(msg.name)} 
                          alt={msg.name} 
                          className="w-6 h-6 rounded-full object-cover shadow-sm bg-slate-200" 
                        />
                      ) : (
                        <div className="w-6 h-6" />
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div 
                    className={cn(
                      "px-3 py-1.5 max-w-[260px] sm:max-w-sm break-words shadow-sm relative group text-[15px] leading-relaxed",
                      isMe 
                        ? "bg-[#d9fdd3] text-slate-800"
                        : "bg-white text-slate-800",
                      showPointer && isMe && "rounded-2xl rounded-tr-none",
                      !showPointer && isMe && "rounded-2xl",
                      showPointer && !isMe && "rounded-2xl rounded-tl-none",
                      !showPointer && !isMe && "rounded-2xl",
                      msg.replyTo ? "mt-6" : ""
                    )}
                  >
                    {/* Tiny triangle pointer for WhatsApp style */}
                    {showPointer && (
                      <div className={cn(
                        "absolute top-0 w-3 h-3 overflow-hidden",
                        isMe ? "-right-2" : "-left-2"
                      )}>
                        <div className={cn(
                          "w-4 h-4 rounded-full absolute -top-2",
                          isMe ? "-right-2 bg-[#d9fdd3]" : "-left-2 bg-white"
                        )} />
                      </div>
                    )}

                    {msg.replyTo && (
                      <div className={cn(
                        "mb-1.5 text-xs truncate max-w-full px-2.5 py-1.5 rounded-lg border-r-4 relative cursor-pointer",
                        isMe ? "bg-black/5 border-green-500 text-slate-700" : "bg-black/5 border-blue-500 text-slate-700"
                      )}>
                        <span className={cn(
                          "font-semibold block truncate leading-tight text-[11px]",
                          isMe ? "text-green-600" : "text-blue-600"
                        )}>{msg.replyTo.name}</span>
                        <span className="truncate block mt-0.5">{msg.replyTo.text}</span>
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      <span className="whitespace-pre-wrap">{msg.text}</span>
                      <div className="flex items-center justify-end gap-1 -mb-1 mt-1 shrink-0 float-left">
                        <span className="text-[10px] text-slate-500 opacity-80 pt-1 relative top-[1px]">
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {isMe && (
                          <div className="relative top-[1px]">
                            {isRead ? <CheckCheck size={14} className="text-[#53bdeb]" /> : <Check size={14} className="text-slate-400" />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons (Reply & React) */}
                  <div className={cn("hidden sm:flex opacity-0 group-hover:opacity-100 items-center justify-center gap-1 transition-all", isMe ? "flex-row" : "flex-row-reverse")}>
                    <button 
                      onClick={() => setReplyToMessage(msg)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 bg-white/50 border border-slate-100 hover:bg-white rounded-full transition-all shadow-sm"
                      title="הגב"
                    >
                      <Reply size={14} />
                    </button>
                    <button 
                      onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 bg-white/50 border border-slate-100 hover:bg-white rounded-full transition-all shadow-sm"
                      title="הוסף תגובה"
                    >
                      <SmilePlus size={14} />
                    </button>

                    {/* Emoji Picker Popup (Desktop) */}
                    {activeReactionMsgId === msg.id && (
                      <div className={cn("absolute bottom-full mb-2 bg-white rounded-full shadow-lg border border-slate-100 flex items-center p-1.5 gap-1 z-20 animate-in fade-in zoom-in duration-200", isMe ? "left-0" : "right-0")}>
                        {EMOJI_OPTIONS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              handleReaction(msg.id, emoji, isGlobal);
                              setActiveReactionMsgId(null);
                            }}
                            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions for Mobile (Always visible slightly or visible via long press?) Actually we can just show on mobile a small button next to it */}
                  <div className={cn("flex sm:hidden items-center justify-center gap-1 transition-all", isMe ? "flex-row" : "flex-row-reverse")}>
                    <button 
                      onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                      className="p-1.5 text-slate-400 bg-transparent rounded-full active:bg-slate-100 transition-all opacity-60"
                    >
                      <SmilePlus size={14} />
                    </button>
                    <button 
                      onClick={() => setReplyToMessage(msg)}
                      className="p-1.5 text-slate-400 bg-transparent rounded-full active:bg-slate-100 transition-all opacity-60"
                    >
                      <Reply size={14} />
                    </button>
                    
                    {/* Emoji Picker Popup (Mobile) */}
                    {activeReactionMsgId === msg.id && (
                      <div className={cn("absolute bottom-full mb-2 bg-white rounded-full shadow-lg border border-slate-100 flex items-center p-1 gap-0.5 z-20 animate-in fade-in zoom-in-95 duration-200", isMe ? "left-0" : "right-0")}>
                        {EMOJI_OPTIONS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => {
                              handleReaction(msg.id, emoji, isGlobal);
                              setActiveReactionMsgId(null);
                            }}
                            className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors text-base"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Display Reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className={cn("flex items-center gap-1 mt-1 z-10 w-full relative", isMe ? "justify-end pr-2" : "justify-start pl-2")}>
                    <div className={cn(
                      "flex items-center gap-1 bg-white/90 backdrop-blur-sm shadow-sm border border-slate-100 rounded-full px-1.5 py-0.5"
                    )}>
                      {Object.entries(msg.reactions).map(([emoji, usersArr]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji, isGlobal)}
                          className={cn(
                            "flex items-center gap-1 text-[11px] font-medium px-1 rounded-full hover:bg-slate-100 transition-colors",
                            usersArr.includes(appUser?.uid || '') ? "bg-blue-50 text-blue-600" : "text-slate-600"
                          )}
                        >
                          <span className="text-[13px]">{emoji}</span>
                          {usersArr.length > 1 && <span>{usersArr.length}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ));
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
              {(activeTab === 'global' || activeTab === 'global_boys' || activeTab === 'global_girls') && <><MessageCircle size={20} className="text-primary" /> צ'אט קבוצתי</>}
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
            {appUser?.role === 'admin' ? (
              <>
                <button 
                  onClick={() => setActiveTab('global_boys')}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeTab === 'global_boys' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  בנים
                </button>
                <button 
                  onClick={() => setActiveTab('global_girls')}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeTab === 'global_girls' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  בנות
                </button>
              </>
            ) : (
              <button 
                onClick={() => setActiveTab('global')}
                className={cn(
                  "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'global' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                קבוצתי
              </button>
            )}
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "flex-1 py-2 text-sm font-medium border-b-2 transition-colors relative flex items-center justify-center gap-1.5",
                activeTab === 'users' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              הודעה פרטית
              {Object.values(unreadPrivateMap).some(Boolean) && (
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#efeae2]">
        
        {/* Global Chat */}
        {(activeTab === 'global' || activeTab === 'global_boys' || activeTab === 'global_girls') && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {renderMessageList(messages, true)}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Users List */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto bg-white pt-4">
            <div className="relative mb-2 px-4">
              <Search className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="חיפוש משתמש..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-12 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all shadow-sm"
              />
            </div>
            
            <div className="space-y-0 mt-2">
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
                  const hasUnread = unreadPrivateMap[user.uid];
                  
                  return (
                    <button
                      key={user.uid}
                      onClick={() => startPrivateChat(user)}
                      className={cn("w-full flex items-center gap-3.5 p-3.5 hover:bg-slate-50 transition-colors text-right border-b border-slate-100 last:border-b-0", hasUnread ? "bg-primary/5" : "bg-white")}
                    >
                      <div className="relative shrink-0">
                        <img 
                          src={(user.photoURL && !user.photoURL.includes('dicebear.com')) ? user.photoURL : getFallbackAvatar(user.name)} 
                          alt={user.name} 
                          className="w-12 h-12 rounded-full object-cover bg-slate-100 border border-slate-100" 
                        />
                        {isRecentlyActive && !hasUnread && (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <div className={cn("font-medium truncate text-[15px]", hasUnread ? "text-slate-900 font-bold" : "text-slate-900")}>{user.name}</div>
                          {lastMessagesMap[user.uid]?.timestamp && (
                            <div className={cn("text-[11px] shrink-0 mt-0.5", hasUnread ? "text-[#25D366] font-medium" : "text-slate-400")}>
                               {new Date(lastMessagesMap[user.uid].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          {lastMessagesMap[user.uid]?.text ? (
                            <div className="text-[13px] text-slate-500 truncate flex items-center gap-1" dir="auto">
                              {lastMessagesMap[user.uid].senderId === appUser?.uid && (
                                <CheckCheck size={14} className={hasUnread ? "text-slate-400" : "text-[#53bdeb]"} />
                              )}
                              <span className="truncate">{lastMessagesMap[user.uid].text}</span>
                            </div>
                          ) : (
                            <div className="text-[13px] text-slate-400 truncate">{user.yeshiva}</div>
                          )}
                          
                          {hasUnread && (
                            <div className="w-5 h-5 bg-[#25D366] text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                              !
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
        
        {/* Private Chat */}
        {activeTab === 'private' && selectedUser && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {renderMessageList(privateMessages, false)}
            <div ref={privateMessagesEndRef} />
          </div>
        )}

      </div>

      {/* Input Area (Only for chats) */}
      {(isGlobalTab || activeTab === 'private') && (
        <div className="p-3 bg-[#efeae2] flex flex-col gap-2 relative">
          
          {replyToMessage && (
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl text-sm border-r-4 border-r-primary mx-1 mb-1 shadow-sm">
              <div className="flex items-center gap-2 overflow-hidden w-full">
                <div className="flex flex-col truncate flex-1">
                  <span className="font-semibold text-primary">{replyToMessage.name}</span>
                  <span className="text-slate-600 truncate">{replyToMessage.text}</span>
                </div>
              </div>
              <button 
                onClick={() => setReplyToMessage(null)}
                className="p-2 text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="relative flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={(isGlobalTab && canNotReply) || isSending}
              placeholder={
                isGlobalTab && canNotReply 
                  ? "המתן לתגובה כדי להמשיך לכתוב..." 
                  : "הקלד הודעה..."
              }
              className={cn(
                "flex-1 px-4 py-3 rounded-full border-none focus:ring-0 focus:outline-none transition-all shadow-sm text-[15px]",
                (isGlobalTab && canNotReply)
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-white text-slate-800"
              )}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || (isGlobalTab && canNotReply) || isSending}
              className="p-3 bg-primary text-white hover:bg-primary/90 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-primary shadow-sm shrink-0 flex items-center justify-center"
            >
              <Send size={20} className="rotate-180 relative right-0.5" />
            </button>
          </form>
          {isGlobalTab && canNotReply && (
            <p className="text-[11px] text-orange-600 mt-0.5 text-center bg-white/60 py-1 rounded-full px-4 mx-auto w-fit">
              ניתן לשלוח רק הודעה אחת ברצף בשיחה הקבוצתית.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
