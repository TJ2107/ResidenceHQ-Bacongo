import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  updateDoc,
  writeBatch,
  limit,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ChatMessage, UserRole, UserSession } from '../types';
import { 
  Send, 
  Search, 
  MessageSquare, 
  Users, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  CheckCheck,
  Sparkles, 
  Lock,
  MessageCircle,
  Hash,
  AlertCircle,
  Paperclip,
  Image as ImageIcon,
  Reply,
  Smile,
  ChevronLeft,
  Filter,
  Building2,
  ChefHat,
  Wrench,
  BedDouble,
  CornerDownLeft,
  Circle,
  MoreVertical,
  Plus
} from 'lucide-react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface ChatModuleProps {
  user: UserProfile;
}

interface ChannelInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
}

const PUBLIC_CHANNELS: ChannelInfo[] = [
  { id: 'general', name: 'Salon Général', description: 'Discussions publiques pour tous les collaborateurs', icon: Hash, category: 'Général' },
  { id: 'reception', name: 'Réception & Accueil', description: 'Echanges check-in, réservations & demandes clients', icon: Building2, category: 'Hôtel' },
  { id: 'kitchen', name: 'Bar & Resto Cuisine', description: 'Suivi des commandes, plats & boissons', icon: ChefHat, category: 'Service' },
  { id: 'maintenance', name: 'Maintenance & Nettoyage', description: 'Signalement pannes, ménage & urgences', icon: Wrench, category: 'Technique' },
];

const CANNED_RESPONSES = [
  "✅ Demande prise en compte",
  "🔑 Chambre prête pour le client",
  "🍹 Commande en cours de préparation",
  "🚨 Intervention urgente requise",
  "👍 Bien reçu, merci !",
];

export const ChatModule = ({ user }: ChatModuleProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Navigation states
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [activeChannelType, setActiveChannelType] = useState<'general' | 'dm'>('general');
  const [activePartner, setActivePartner] = useState<UserProfile | null>(null);
  const [activeChannelInfo, setActiveChannelInfo] = useState<ChannelInfo | null>(PUBLIC_CHANNELS[0]);
  
  // Mobile responsive view toggle (true = show conversation, false = show contact list)
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(false);

  // Filters & Search
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'channels' | 'dms' | 'unread'>('all');
  
  // Message input & state
  const [messageText, setMessageText] = useState('');
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showQuickResponses, setShowQuickResponses] = useState(false);

  // Editing / Deleting message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);

  // Search inside active chat
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchText, setChatSearchText] = useState('');

  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesFeedRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevChannelIdRef = useRef<string>(activeChannelId);

  // 1. Fetch all users for direct messaging
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('username'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(allUsers);
      setLoadingUsers(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch all user sessions in real-time to monitor online/offline status
  useEffect(() => {
    const q = collection(db, 'sessions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserSession));
      setSessions(allSessions);
    }, (error) => {
      console.error("Error fetching sessions in ChatModule:", error);
    });

    return () => unsubscribe();
  }, []);

  // 3. Fetch all messages in real-time across channels for unread badges & preview
  useEffect(() => {
    setLoadingMessages(true);
    const q = collection(db, 'messages');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp || { toMillis: () => Date.now(), toDate: () => new Date() }
        } as ChatMessage;
      });

      // Sort messages client side by timestamp
      fetchedMessages.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeA - timeB;
      });

      setAllMessages(fetchedMessages);
      setLoadingMessages(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter messages for active channel
  const activeMessages = allMessages.filter(m => m.channelId === activeChannelId);

  // Filter messages when searching inside active chat
  const displayedActiveMessages = chatSearchText.trim()
    ? activeMessages.filter(m => m.text.toLowerCase().includes(chatSearchText.toLowerCase()))
    : activeMessages;

  // Mark unread messages in current active conversation as read
  useEffect(() => {
    if (!user || !user.id || !activeMessages || activeMessages.length === 0) return;

    const unreadMessages = activeMessages.filter(
      (msg) => 
        msg.senderId !== user.id && 
        (!msg.readBy || !msg.readBy.includes(user.id))
    );

    if (unreadMessages.length > 0) {
      const markMessagesRead = async () => {
        try {
          const batch = writeBatch(db);
          let hasUpdates = false;
          
          unreadMessages.forEach((msg) => {
            const msgRef = doc(db, 'messages', msg.id);
            batch.update(msgRef, {
              readBy: arrayUnion(user.id)
            });
            hasUpdates = true;
          });
          
          if (hasUpdates) {
            await batch.commit();
          }
        } catch (error) {
          console.error("Error marking messages as read: ", error);
        }
      };
      
      // Mark as read quickly but with a tiny debounce to prevent redundant writes on rapid state changes
      const timer = setTimeout(markMessagesRead, 100);
      return () => clearTimeout(timer);
    }
  }, [activeMessages.length, user.id, activeChannelId]);

  // Scroll to bottom when new message arrives or channel switches
  useEffect(() => {
    const isChannelChanged = prevChannelIdRef.current !== activeChannelId;
    prevChannelIdRef.current = activeChannelId;

    if (messagesFeedRef.current) {
      if (isChannelChanged) {
        // Instant scroll without animation on channel/correspondent switch for visual stability
        messagesFeedRef.current.scrollTop = messagesFeedRef.current.scrollHeight;
      } else {
        // Smooth scroll for new incoming messages in active conversation
        messagesFeedRef.current.scrollTo({
          top: messagesFeedRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [activeChannelId, activeMessages.length, mobileShowChat]);

  // Online check
  const isOnline = (lastActive: any) => {
    if (!lastActive) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    try {
      if (typeof lastActive.toMillis === 'function') {
        return lastActive.toMillis() > fiveMinutesAgo;
      }
      if (typeof lastActive.toDate === 'function') {
        return lastActive.toDate().getTime() > fiveMinutesAgo;
      }
      if (lastActive.seconds) {
        return (lastActive.seconds * 1000) > fiveMinutesAgo;
      }
      if (lastActive instanceof Date) {
        return lastActive.getTime() > fiveMinutesAgo;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  // Helper DM channel ID
  const getDmChannelId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  // Switch to channel
  const selectPublicChannel = (channel: ChannelInfo) => {
    setActiveChannelId(channel.id);
    setActiveChannelType('general');
    setActivePartner(null);
    setActiveChannelInfo(channel);
    setMobileShowChat(true);
    setReplyingTo(null);
    setSelectedImageBase64(null);
    setEditingMessageId(null);
    setShowChatSearch(false);
    setChatSearchText('');
  };

  // Switch to DM
  const selectDmPartner = (partner: UserProfile) => {
    const dmId = getDmChannelId(user.id, partner.id);
    setActiveChannelId(dmId);
    setActiveChannelType('dm');
    setActivePartner(partner);
    setActiveChannelInfo(null);
    setMobileShowChat(true);
    setReplyingTo(null);
    setSelectedImageBase64(null);
    setEditingMessageId(null);
    setShowChatSearch(false);
    setChatSearchText('');
  };

  // Compute unread count for a given channel or DM
  const getUnreadCount = (channelId: string) => {
    return allMessages.filter(
      m => m.channelId === channelId && 
           m.senderId !== user.id && 
           (!m.readBy || !m.readBy.includes(user.id))
    ).length;
  };

  // Get last message info for sidebar preview
  const getLastMessage = (channelId: string) => {
    const msgs = allMessages.filter(m => m.channelId === channelId);
    if (msgs.length === 0) return null;
    return msgs[msgs.length - 1];
  };

  // Handle image processing (compression + state update)
  const processImage = (file: File) => {
    // Show loading toast for compression if file is somewhat large
    const isLarge = file.size > 200 * 1024;
    let toastId: string | number | undefined;
    if (isLarge) {
      toastId = toast.loading('Traitement de l\'image...');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Target max dimensions and quality to keep Base64 < 800KB
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max_size = 1000; // Max 1000px width or height

        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Use lower quality to ensure it fits in Firestore (1MB limit)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          
          // Final size check for Base64 (approx 1.33 * binary size)
          if (compressedBase64.length > 900 * 1024) {
             toast.error('L\'image est encore trop lourde après compression.', { id: toastId });
          } else {
             setSelectedImageBase64(compressedBase64);
             if (toastId) toast.dismiss(toastId);
          }
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      img.onerror = () => {
        toast.error('Erreur lors de la lecture de l\'image.', { id: toastId });
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle image attachment selection with compression
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImage(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    } else if (file) {
      toast.error('Seules les images sont acceptées.');
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !selectedImageBase64) return;

    const trimmedMsg = messageText.trim();
    if (trimmedMsg.length > 2000) {
      toast.error('Le message ne peut pas dépasser 2000 caractères.');
      return;
    }

    try {
      const payload: any = {
        senderId: user.id,
        senderName: user.username,
        senderRole: user.role,
        text: trimmedMsg,
        timestamp: serverTimestamp(),
        channelId: activeChannelId,
        readBy: [user.id]
      };

      if (replyingTo) {
        payload.replyTo = {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyingTo.text
        };
      }

      if (selectedImageBase64) {
        payload.imageUrl = selectedImageBase64;
      }

      setMessageText('');
      setSelectedImageBase64(null);
      setReplyingTo(null);
      setShowQuickResponses(false);

      await addDoc(collection(db, 'messages'), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  // Update message
  const handleUpdateMessage = async (msgId: string) => {
    if (!editingText.trim()) return;

    try {
      await updateDoc(doc(db, 'messages', msgId), {
        text: editingText.trim(),
        timestamp: serverTimestamp()
      });
      setEditingMessageId(null);
      setEditingText('');
      toast.success('Message mis à jour');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `messages/${msgId}`);
    }
  };

  // Delete message
  const executeDeleteMessage = async () => {
    if (!confirmDeleteMsgId) return;
    const msgId = confirmDeleteMsgId;
    setConfirmDeleteMsgId(null);

    try {
      await deleteDoc(doc(db, 'messages', msgId));
      toast.success('Message supprimé');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `messages/${msgId}`);
    }
  };

  // Role badges formatting
  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'manager':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'receptionist':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'cook':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'barman':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'staff':
        return 'bg-stone-50 text-stone-600 border-stone-200';
      case 'maintenance':
        return 'bg-cyan-50 text-cyan-600 border-cyan-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const formatRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'manager': return 'Gérant';
      case 'receptionist': return 'Réception';
      case 'cook': return 'Cuisine';
      case 'barman': return 'Barman';
      case 'staff': return 'Équipe';
      case 'maintenance': return 'Technicien';
      default: return role;
    }
  };

  // Time & Date formatters
  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date();
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  const formatShortDate = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date();
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return formatTime(ts);
    }
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Filter contacts / teammates
  const filteredTeammates = users.filter(u => 
    u.id !== user.id && 
    (u.username.toLowerCase().includes(sidebarSearch.toLowerCase()) || 
     u.role.toLowerCase().includes(sidebarSearch.toLowerCase()) || 
     u.email.toLowerCase().includes(sidebarSearch.toLowerCase()))
  );

  // Filter channels
  const filteredChannels = PUBLIC_CHANNELS.filter(c =>
    c.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  return (
    <div id="chat_main_container" className="flex flex-col lg:flex-row h-full w-full bg-[#111b21]/5 dark:bg-[#0b141a] rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl border border-secondary/20 flex-1 min-h-0">
      
      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR: Channels and Direct Conversations                    */}
      {/* ------------------------------------------------------------- */}
      <div 
        id="chat_sidebar" 
        className={cn(
          "w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-white dark:bg-[#111b21] border-r border-secondary/15 h-full transition-all shrink-0",
          mobileShowChat ? "hidden lg:flex" : "flex"
        )}
      >
        {/* Sidebar Top Profile & Header */}
        <div className="p-3.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-secondary/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-sm">
                {user.username[0]?.toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title="En ligne" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111b21] dark:text-white truncate max-w-[170px]">{user.username}</h3>
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[8px] font-bold border uppercase tracking-wider inline-block",
                getRoleBadgeStyle(user.role)
              )}>
                {formatRoleLabel(user.role)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
              WhatsApp HQ
            </span>
          </div>
        </div>

        {/* Search Bar & Filter Chips */}
        <div className="p-3 bg-white dark:bg-[#111b21] border-b border-secondary/10 flex flex-col gap-2.5">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Rechercher une discussion..." 
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border border-transparent rounded-xl outline-none text-xs font-medium focus:bg-white focus:border-primary transition-all text-[#111b21] dark:text-white placeholder:text-stone-400"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            {sidebarSearch && (
              <button onClick={() => setSidebarSearch('')} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* WhatsApp Style Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'channels', label: 'Salons' },
              { id: 'dms', label: 'Directs' },
              { id: 'unread', label: 'Non lus' },
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setFilterType(chip.id as any)}
                className={cn(
                  "px-3 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap",
                  filterType === chip.id
                    ? "bg-[#00a884] text-white shadow-sm"
                    : "bg-[#f0f2f5] dark:bg-[#202c33] text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List Scrollable Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-secondary/10 dark:divide-stone-800">
          
          {/* Section 1: Salons Publics */}
          {((filterType === 'all' || filterType === 'channels' || filterType === 'unread')) && (
            <div>
              <div className="px-4 py-2 bg-[#f0f2f5]/50 dark:bg-[#202c33]/40 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center justify-between">
                <span>Salons d'équipe ({filteredChannels.length})</span>
                <Hash className="w-3.5 h-3.5 opacity-60" />
              </div>

              {filteredChannels.map(channel => {
                const isActive = activeChannelId === channel.id;
                const unread = getUnreadCount(channel.id);
                const lastMsg = getLastMessage(channel.id);
                const ChannelIcon = channel.icon;

                if (filterType === 'unread' && unread === 0) return null;

                return (
                  <button
                    key={channel.id}
                    onClick={() => selectPublicChannel(channel)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 text-left transition-all hover:bg-[#f0f2f5] dark:hover:bg-[#202c33]",
                      isActive && "bg-[#f0f2f5] dark:bg-[#2a3942] border-l-4 border-[#00a884]"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className={cn(
                        "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border transition-all",
                        isActive ? "bg-primary text-white border-primary" : "bg-primary/10 text-primary border-primary/20"
                      )}>
                        <ChannelIcon className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-[#111b21] dark:text-white truncate">
                          {channel.name}
                        </h4>
                        {lastMsg && (
                          <span className={cn(
                            "text-[10px] font-medium shrink-0 ml-1",
                            unread > 0 ? "text-[#00a884] font-bold" : "text-stone-400"
                          )}>
                            {formatShortDate(lastMsg.timestamp)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1 gap-1">
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate font-normal flex-1">
                          {lastMsg ? (
                            <>
                              <span className="font-semibold text-stone-700 dark:text-stone-300">{lastMsg.senderName}: </span>
                              {lastMsg.text || '📷 Photo'}
                            </>
                          ) : (
                            <span className="italic text-stone-400">{channel.description}</span>
                          )}
                        </p>

                        {unread > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Section 2: Discussions Privées */}
          {(filterType === 'all' || filterType === 'dms' || filterType === 'unread') && (
            <div>
              <div className="px-4 py-2 bg-[#f0f2f5]/50 dark:bg-[#202c33]/40 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center justify-between">
                <span>Discussions Directes ({filteredTeammates.length})</span>
                <Users className="w-3.5 h-3.5 opacity-60" />
              </div>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                </div>
              ) : filteredTeammates.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400">
                  Aucun collaborateur trouvé
                </div>
              ) : (
                filteredTeammates.map((mate) => {
                  const dmId = getDmChannelId(user.id, mate.id);
                  const isActive = activeChannelId === dmId;
                  const unread = getUnreadCount(dmId);
                  const lastMsg = getLastMessage(dmId);

                  const mateSession = sessions.find(s => s.id === mate.id);
                  const isMateOnline = mateSession ? isOnline(mateSession.lastActive) : false;

                  if (filterType === 'unread' && unread === 0) return null;

                  return (
                    <button
                      key={mate.id}
                      onClick={() => selectDmPartner(mate)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 text-left transition-all hover:bg-[#f0f2f5] dark:hover:bg-[#202c33]",
                        isActive && "bg-[#f0f2f5] dark:bg-[#2a3942] border-l-4 border-[#00a884]"
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-secondary/20 text-[#111b21] dark:text-white flex items-center justify-center font-bold text-base border border-secondary/30">
                          {mate.username[0]?.toUpperCase()}
                        </div>
                        <span 
                          className={cn(
                            "absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-[#111b21] rounded-full transition-colors",
                            isMateOnline ? "bg-emerald-500" : "bg-stone-300"
                          )} 
                          title={isMateOnline ? "En ligne" : "Hors ligne"} 
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="font-bold text-xs text-[#111b21] dark:text-white truncate">
                              {mate.username}
                            </h4>
                            <span className={cn(
                              "px-1 py-0.1 rounded text-[7px] font-bold border uppercase tracking-wider shrink-0",
                              getRoleBadgeStyle(mate.role)
                            )}>
                              {formatRoleLabel(mate.role)}
                            </span>
                          </div>

                          {lastMsg && (
                            <span className={cn(
                              "text-[10px] font-medium shrink-0 ml-1",
                              unread > 0 ? "text-[#00a884] font-bold" : "text-stone-400"
                            )}>
                              {formatShortDate(lastMsg.timestamp)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-1 gap-1">
                          <p className="text-xs text-stone-500 dark:text-stone-400 truncate font-normal flex-1">
                            {lastMsg ? (
                              <>
                                {lastMsg.senderId === user.id && (
                                  <span className="text-stone-400 mr-1">Vous:</span>
                                )}
                                {lastMsg.text || '📷 Photo'}
                              </>
                            ) : (
                              <span className="italic text-stone-400">Démarrer une conversation...</span>
                            )}
                          </p>

                          {unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>


      {/* ------------------------------------------------------------- */}
      {/* MAIN CHAT WINDOW: Active Conversation Panel                    */}
      {/* ------------------------------------------------------------- */}
      <div 
        id="chat_conversation_pane" 
        className={cn(
          "flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a] h-full relative overflow-hidden",
          mobileShowChat ? "flex" : "hidden lg:flex"
        )}
        style={{
          backgroundImage: `radial-gradient(rgba(0,0,0,0.03) 1px, transparent 0)`,
          backgroundSize: '16px 16px'
        }}
      >
        {/* Active Conversation Header */}
        <div className="p-3.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-secondary/15 flex items-center justify-between z-10 shadow-sm shrink-0 min-h-[64px]">
          <div className="flex items-center gap-3">
            {/* Mobile Back Button */}
            <button
              onClick={() => setMobileShowChat(false)}
              className="lg:hidden p-1.5 hover:bg-black/5 rounded-full text-stone-600 dark:text-stone-300"
              title="Retour à la liste"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {activeChannelType === 'general' ? (
              <>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
                  {activeChannelInfo ? <activeChannelInfo.icon className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#111b21] dark:text-white flex items-center gap-2">
                    {activeChannelInfo?.name || 'Salon Général'}
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Groupe d'équipe
                    </span>
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-normal">
                    {activeChannelInfo?.description || 'Canal public d\'hôtel'}
                  </p>
                </div>
              </>
            ) : (
              (() => {
                if (!activePartner) return null;
                const partnerSession = sessions.find(s => s.id === activePartner.id);
                const isPartnerOnline = partnerSession ? isOnline(partnerSession.lastActive) : false;
                return (
                  <>
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-secondary/30 text-[#111b21] dark:text-white flex items-center justify-center font-bold text-base border border-secondary/40">
                        {activePartner.username[0]?.toUpperCase()}
                      </div>
                      <span className={cn(
                        "absolute bottom-0 right-0 w-3 h-3 border-2 border-white dark:border-[#202c33] rounded-full transition-colors",
                        isPartnerOnline ? "bg-emerald-500" : "bg-stone-300"
                      )} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#111b21] dark:text-white flex items-center gap-2">
                        {activePartner.username}
                        <span className={cn(
                          "px-1.5 py-0.2 rounded text-[8px] font-bold border uppercase tracking-wider",
                          getRoleBadgeStyle(activePartner.role)
                        )}>
                          {formatRoleLabel(activePartner.role)}
                        </span>
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 font-normal">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isPartnerOnline ? "bg-emerald-500" : "bg-stone-400"
                        )} />
                        <span>{isPartnerOnline ? "En ligne" : "Hors ligne"}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <Lock className="w-3 h-3" />
                          Discussion privée
                        </span>
                      </p>
                    </div>
                  </>
                );
              })()
            )}
          </div>

          {/* Action buttons on Header */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChatSearch(!showChatSearch)}
              className={cn(
                "p-2 rounded-full transition-colors text-stone-600 dark:text-stone-300",
                showChatSearch ? "bg-primary text-white" : "hover:bg-stone-200 dark:hover:bg-stone-700"
              )}
              title="Rechercher dans cette discussion"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Search Overlay Banner */}
        <AnimatePresence>
          {showChatSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-2 bg-white dark:bg-[#111b21] border-b border-secondary/20 flex items-center gap-2 z-10 shrink-0"
            >
              <Search className="w-4 h-4 text-stone-400 ml-2" />
              <input
                type="text"
                placeholder="Rechercher un terme dans ce canal..."
                value={chatSearchText}
                onChange={(e) => setChatSearchText(e.target.value)}
                className="flex-1 bg-transparent text-xs p-1 outline-none text-[#111b21] dark:text-white"
                autoFocus
              />
              {chatSearchText && (
                <button onClick={() => setChatSearchText('')} className="text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Feed Area */}
        <div 
          ref={messagesFeedRef} 
          className={cn(
            "flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar transition-colors relative",
            isDragging && "bg-[#00a884]/10 dark:bg-[#00a884]/20"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag & Drop Overlay Visual */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-[#00a884]/40 backdrop-blur-[2px] border-4 border-dashed border-[#00a884] m-4 rounded-3xl"
              >
                <div className="bg-white dark:bg-[#111b21] p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-[#00a884]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#111b21] dark:text-white">Déposez l'image ici</h3>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Elle sera automatiquement compressée et ajoutée au message.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent animate-spin rounded-full" />
              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Chargement des messages...</p>
            </div>
          ) : displayedActiveMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center p-6 bg-white/70 dark:bg-[#111b21]/70 backdrop-blur-md border border-secondary/20 rounded-3xl shadow-sm my-auto">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-[#00a884]/10 rounded-full flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-[#00a884]" />
              </div>
              <p className="font-bold text-sm text-[#111b21] dark:text-white uppercase tracking-wide">
                Début de la transmission
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                {activeChannelType === 'general'
                  ? `Aucun message dans ${activeChannelInfo?.name || 'ce salon'}. Envoyez la première communication d'équipe !`
                  : `Vos messages directs avec ${activePartner?.username} sont strictement confidentiels.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedActiveMessages.map((msg, index) => {
                const isMe = msg.senderId === user.id;

                // Date separator logic
                const showDateSeparator = index === 0 || 
                  formatDateLabel(displayedActiveMessages[index - 1]?.timestamp) !== formatDateLabel(msg.timestamp);

                return (
                  <div key={msg.id} className="space-y-2">
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-3">
                        <span className="px-3 py-1 rounded-lg bg-white/90 dark:bg-[#111b21]/90 shadow-sm border border-stone-200 dark:border-stone-800 text-[10px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                          {formatDateLabel(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    {/* WhatsApp Message Bubble Container */}
                    <div className={cn(
                      "flex group relative max-w-[85%] sm:max-w-[70%] xl:max-w-[60%]",
                      isMe ? "ml-auto justify-end" : "mr-auto justify-start"
                    )}>
                      
                      <div className={cn(
                        "p-3 rounded-2xl shadow-sm relative text-xs leading-relaxed transition-all",
                        isMe 
                          ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-stone-100 rounded-tr-none border border-[#c1ebb8] dark:border-[#005c4b]" 
                          : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-stone-100 rounded-tl-none border border-stone-200 dark:border-stone-700"
                      )}>
                        
                        {/* Header Sender Name in Channel Group Chats */}
                        {!isMe && activeChannelType === 'general' && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[#00a884] dark:text-[#25D366] text-[11px]">
                              {msg.senderName}
                            </span>
                            <span className={cn(
                              "px-1 py-0.1 rounded text-[7px] font-bold border uppercase tracking-wider",
                              getRoleBadgeStyle(msg.senderRole as UserRole)
                            )}>
                              {formatRoleLabel(msg.senderRole as UserRole)}
                            </span>
                          </div>
                        )}

                        {/* Quoted Reply Preview Box */}
                        {msg.replyTo && (
                          <div className="mb-2 p-2 rounded-lg bg-black/5 dark:bg-white/10 border-l-4 border-primary text-[11px]">
                            <p className="font-bold text-primary dark:text-emerald-400">
                              {msg.replyTo.senderName}
                            </p>
                            <p className="text-stone-600 dark:text-stone-300 truncate">
                              {msg.replyTo.text}
                            </p>
                          </div>
                        )}

                        {/* Image Attachment Preview */}
                        {msg.imageUrl && (
                          <div className="mb-2 overflow-hidden rounded-xl border border-black/10">
                            <img src={msg.imageUrl} alt="Attachement" className="max-h-60 w-full object-cover" />
                          </div>
                        )}

                        {/* Edit Mode vs Normal View */}
                        {editingMessageId === msg.id ? (
                          <div className="flex flex-col gap-2 min-w-[220px]">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full text-xs text-[#111b21] p-2 bg-white dark:bg-[#111b21] dark:text-white border border-stone-300 rounded-xl outline-none resize-none font-medium"
                              rows={2}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="p-1 text-xs font-bold text-stone-500 hover:text-stone-700"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={() => handleUpdateMessage(msg.id)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                              >
                                Sauvegarder
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap break-words font-normal">
                              {msg.text}
                            </p>

                            {/* Timestamp & Read Status Indicators */}
                            <div className={cn(
                              "flex items-center justify-end gap-1 text-[9px] mt-1 font-semibold",
                              isMe ? "text-stone-500 dark:text-emerald-200" : "text-stone-400"
                            )}>
                              <span>{formatTime(msg.timestamp)}</span>

                              {isMe && (
                                msg.readBy && msg.readBy.some(uid => uid !== msg.senderId) ? (
                                  <div className="flex -space-x-1 text-[#53bdeb]" >
                                    <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </div>
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-stone-400 stroke-[2.5]"  />
                                )
                              )}
                            </div>
                          </>
                        )}

                        {/* Hover Quick Action Menu */}
                        <div className={cn(
                          "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-[#202c33] border border-stone-200 dark:border-stone-700 rounded-lg shadow-md p-1 flex items-center gap-1 z-10",
                          isMe ? "-left-16" : "-right-16"
                        )}>
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 rounded"
                            title="Répondre à ce message"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>

                          {isMe && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditingText(msg.text);
                                }}
                                className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 rounded"
                                title="Modifier"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteMsgId(msg.id)}
                                className="p-1 hover:bg-red-50 text-red-500 rounded"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>


        {/* ------------------------------------------------------------- */}
        {/* INPUT BAR: Bottom Messaging Control                             */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-[#f0f2f5] dark:bg-[#202c33] border-t border-secondary/15 flex flex-col shrink-0">
          
          {/* Quick Replying Banner Preview */}
          <AnimatePresence>
            {replyingTo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 py-2 bg-white dark:bg-[#111b21] border-b border-secondary/15 flex items-center justify-between"
              >
                <div className="border-l-4 border-[#00a884] pl-3 text-xs">
                  <p className="font-bold text-[#00a884]">Réponse à {replyingTo.senderName}</p>
                  <p className="text-stone-600 dark:text-stone-300 truncate max-w-lg">{replyingTo.text}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Selected Preview Banner */}
          <AnimatePresence>
            {selectedImageBase64 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-3 bg-stone-900/10 dark:bg-stone-900/50 flex items-center gap-3 border-b border-secondary/15"
              >
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-sm shrink-0">
                  <img src={selectedImageBase64} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setSelectedImageBase64(null)} 
                    className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 text-white rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                  Photo prête à être transmise
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Responses Popover Chips */}
          <AnimatePresence>
            {showQuickResponses && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-2 bg-white dark:bg-[#111b21] border-b border-secondary/15 flex gap-2 overflow-x-auto hide-scrollbar"
              >
                {CANNED_RESPONSES.map((resp, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setMessageText(resp);
                      setShowQuickResponses(false);
                    }}
                    className="px-3 py-1.5 bg-[#f0f2f5] dark:bg-[#202c33] hover:bg-emerald-50 hover:text-emerald-700 text-stone-700 dark:text-stone-300 text-xs font-medium rounded-full whitespace-nowrap border border-stone-200 dark:border-stone-700 transition-all"
                  >
                    {resp}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 flex items-center gap-2">
            
            {/* Quick Canned Response Button */}
            <button
              type="button"
              onClick={() => setShowQuickResponses(!showQuickResponses)}
              className={cn(
                "p-2.5 rounded-full transition-colors text-stone-500 hover:text-stone-700 dark:text-stone-300",
                showQuickResponses && "bg-emerald-100 text-emerald-800"
              )}
              title="Réponses rapides de l'hôtel"
            >
              <Sparkles className="w-5 h-5 text-amber-500" />
            </button>

            {/* Hidden File Input & Trigger Button */}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-300 transition-colors"
              title="Joindre une photo"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {/* Textarea Input */}
            <input
              type="text"
              placeholder={
                activeChannelType === 'general'
                  ? `Message dans ${activeChannelInfo?.name || 'Salon Général'}...`
                  : `Message confidentiel à ${activePartner?.username}...`
              }
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              maxLength={2000}
              className="flex-1 py-2.5 px-4 bg-white dark:bg-[#2a3942] border border-transparent focus:border-[#00a884] rounded-xl outline-none font-medium text-xs text-[#111b21] dark:text-white placeholder:text-stone-400 transition-all shadow-inner"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!messageText.trim() && !selectedImageBase64}
              className="p-3 rounded-full bg-[#00a884] hover:bg-[#008f70] text-white disabled:opacity-40 shadow-md font-bold transition-all shrink-0"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteMsgId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-[#111b21] border border-secondary/30 shadow-2xl rounded-2xl p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase text-[#111b21] dark:text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Supprimer ce message ?
                </h3>
                <button onClick={() => setConfirmDeleteMsgId(null)} className="p-1 hover:bg-stone-100 rounded-full text-stone-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 mb-5 leading-relaxed">
                Le message sera définitivement retiré des transmissions d'équipe. Cette action est irréversible.
              </p>

              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setConfirmDeleteMsgId(null)}
                  className="flex-1 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-bold uppercase tracking-wider text-[10px]"
                >
                  Annuler
                </button>
                <button 
                  type="button"
                  onClick={executeDeleteMessage}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl shadow-md font-bold hover:bg-red-700 uppercase tracking-wider text-[10px]"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
