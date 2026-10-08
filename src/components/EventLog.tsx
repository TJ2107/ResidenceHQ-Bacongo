import { UserProfile } from "../types";
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { EventLog as EventLogType, UserSession } from '../types';
import { History, Users, Activity, Search, Filter, Clock, User as UserIcon, Shield, ChevronDown, ChevronUp, Calendar, X, KeyRound, Info, Eye, Laptop, MapPin, CheckCircle2, LogOut, ArrowRight, Sparkles, Monitor, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface EventLogProps {
  user?: UserProfile;
}

interface ParsedLogDetails {
  isStructured: boolean;
  actionSummary?: string;
  roleTitle?: string;
  location?: string;
  scope?: string;
  account?: string;
  terminal?: string;
  timestampStr?: string;
  rawText: string;
}

const parseConnectionLog = (details: string): ParsedLogDetails => {
  if (!details) return { isStructured: false, rawText: '' };

  const parsed: ParsedLogDetails = {
    isStructured: false,
    rawText: details
  };

  // Check multi-line format
  if (details.includes('Action :') || details.includes('Poste & Rôle :') || details.includes('Affectation :') || details.includes('Terminal & Navigateur :')) {
    parsed.isStructured = true;
    const lines = details.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('Action :')) parsed.actionSummary = trimmed.replace('Action :', '').trim();
      else if (trimmed.startsWith('Poste & Rôle :')) parsed.roleTitle = trimmed.replace('Poste & Rôle :', '').trim();
      else if (trimmed.startsWith('Affectation :')) parsed.location = trimmed.replace('Affectation :', '').trim();
      else if (trimmed.startsWith("Périmètre d'action :")) parsed.scope = trimmed.replace("Périmètre d'action :", '').trim();
      else if (trimmed.startsWith('Compte utilisateur :') || trimmed.startsWith('Compte :')) parsed.account = trimmed.replace(/Compte( utilisateur)? :/, '').trim();
      else if (trimmed.startsWith('Terminal & Navigateur :') || trimmed.startsWith('Terminal :')) parsed.terminal = trimmed.replace(/Terminal( & Navigateur)? :/, '').trim();
      else if (trimmed.startsWith('Heure de connexion :')) parsed.timestampStr = trimmed.replace('Heure de connexion :', '').trim();
    });
    return parsed;
  }

  // Check pipe-delimited format (e.g. 🔑 Connexion système — Utilisateur: ... | Rôle: ... | Lieu affecté: ... | Démarrage session à ...)
  if (details.includes('|')) {
    parsed.isStructured = true;
    const parts = details.split('|').map(p => p.trim());
    parts.forEach(part => {
      if (part.includes('Connexion') || part.includes('Déconnexion') || part.includes('Action')) {
        parsed.actionSummary = part.replace(/^🔑\s*/, '').trim();
      }
      if (part.includes('Utilisateur:')) parsed.account = part.replace('Utilisateur:', '').trim();
      else if (part.includes('Utilisateur :')) parsed.account = part.replace('Utilisateur :', '').trim();

      if (part.includes('Rôle:')) parsed.roleTitle = part.replace('Rôle:', '').trim();
      else if (part.includes('Rôle :')) parsed.roleTitle = part.replace('Rôle :', '').trim();

      if (part.includes('Lieu affecté:')) parsed.location = part.replace('Lieu affecté:', '').trim();
      else if (part.includes('Lieu affecté :')) parsed.location = part.replace('Lieu affecté :', '').trim();

      if (part.includes('Démarrage session à')) parsed.timestampStr = part.replace('Démarrage session à', '').trim();
      else if (part.includes('Heure de déconnexion :')) parsed.timestampStr = part.replace('Heure de déconnexion :', '').trim();
    });
    return parsed;
  }

  return parsed;
};

export const EventLog: React.FC<EventLogProps> = ({ user }) => {
  const [logs, setLogs] = useState<EventLogType[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'logs' | 'presence'>('logs');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<EventLogType | null>(null);

  useEffect(() => {
    // Listen to logs
    const logsQuery = query(collection(db, 'event_logs'), orderBy('timestamp', 'desc'), limit(250));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventLogType)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'event_logs');
      setLoading(false);
    });

    // Listen to sessions (presence)
    const sessionsQuery = query(collection(db, 'sessions'), orderBy('lastActive', 'desc'));
    const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserSession)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    return () => {
      unsubLogs();
      unsubSessions();
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || log.userRole === filterRole;
    const matchesAction = filterAction === 'all' || 
      (filterAction === 'Connexion' ? (log.action === 'Connexion' || log.action === 'Déconnexion') : log.action === filterAction);
    return matchesSearch && matchesRole && matchesAction;
  });

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => prev.includes(groupKey) ? prev.filter(k => k !== groupKey) : [...prev, groupKey]);
  };

  const groupedLogs = filteredLogs.reduce((acc, log) => {
    if (!log.timestamp?.toDate) {
      if (!acc['Inconnu']) acc['Inconnu'] = [];
      acc['Inconnu'].push(log);
      return acc;
    }
    const date = log.timestamp.toDate();
    let key = '';
    
    if (groupBy === 'day') {
      key = format(date, 'yyyy-MM-dd');
    } else if (groupBy === 'week') {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      key = `Du ${format(start, 'dd/MM', { locale: fr })} au ${format(end, 'dd/MM/yyyy', { locale: fr })}`;
    } else if (groupBy === 'month') {
      key = format(date, 'MMMM yyyy', { locale: fr });
    }

    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, EventLogType[]>);

  const sortedGroupKeys = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));
  
  useEffect(() => {
    if (sortedGroupKeys.length > 0 && expandedGroups.length === 0) {
      setExpandedGroups([sortedGroupKeys[0]]);
    }
  }, [sortedGroupKeys, expandedGroups.length]);

  // A user is considered online if active in the last 5 minutes
  const isOnline = (lastActive: Timestamp) => {
    if (!lastActive) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return lastActive.toMillis() > fiveMinutesAgo;
  };

  const onlineUsers = sessions.filter(s => isOnline(s.lastActive));

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700 border-red-200';
      case 'manager': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'receptionist': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'caissiere': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'cook': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'serveur': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'barman': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'valet_de_chambre': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'chauffeur': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'client': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Journal d'Événements</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Suivi de l'activité et présence des utilisateurs</p>
        </div>

        <div className="flex bg-[#FDFBF7] p-1 rounded-2xl border border-secondary/20 self-start">
          <button 
            onClick={() => setActiveTab('logs')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === 'logs' ? "bg-white shadow-sm text-primary" : "text-[#2B2321]/40 hover:text-[#2B2321]/60"
            )}
          >
            <Activity className="w-4 h-4" />
            Activités
          </button>
          <button 
            onClick={() => setActiveTab('presence')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === 'presence' ? "bg-white shadow-sm text-primary" : "text-[#2B2321]/40 hover:text-[#2B2321]/60"
            )}
          >
            <Users className="w-4 h-4" />
            Présence ({onlineUsers.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-secondary/30 shadow-sm space-y-4">
            <h3 className="text-[10px] md:text-sm font-bold uppercase tracking-widest text-[#2B2321]/60 flex items-center gap-2">
              <Users className="w-4 h-4" />
              En Ligne
            </h3>
            <div className="space-y-3">
              {onlineUsers.length === 0 ? (
                <p className="text-[10px] md:text-xs text-[#2B2321]/40 italic">Aucun utilisateur actif</p>
              ) : (
                onlineUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#FDFBF7] transition-colors">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div>
                      <p className="text-[10px] md:text-sm font-bold text-[#2B2321]">{user.username}</p>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-tighter", getRoleColor(user.role))}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-primary p-6 rounded-3xl shadow-lg shadow-primary/20 text-white space-y-2">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-60">Total Logs</p>
            <p className="text-2xl md:text-4xl font-bold tracking-tighter">{logs.length}</p>
            <div className="pt-4 flex items-center gap-2 text-[8px] md:text-[10px] font-bold uppercase tracking-widest opacity-80">
              <Clock className="w-3 h-3" />
              Dernière mise à jour: {format(new Date(), 'HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'logs' ? (
            <>
              {/* Filters & Grouping */}
              <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2B2321]/30" />
                    <input 
                      type="text"
                      placeholder="Rechercher par utilisateur, action ou détails..."
                      className="w-full pl-12 pr-4 py-3 bg-white border border-secondary/30 rounded-2xl outline-none focus:border-primary transition-all font-medium text-[10px] md:text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2B2321]/30" />
                    <select 
                      className="pl-12 pr-8 py-3 bg-white border border-secondary/30 rounded-2xl outline-none focus:border-primary transition-all font-bold text-[10px] md:text-xs uppercase tracking-widest appearance-none cursor-pointer h-full"
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                    >
                      <option value="all">Tous les rôles</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="receptionist">Réceptionniste</option>
                      <option value="caissiere">Caissière (POS)</option>
                      <option value="serveur">Serveur</option>
                      <option value="cook">Cuisinier</option>
                      <option value="barman">Barman</option>
                      <option value="valet_de_chambre">Valet de chambre</option>
                      <option value="chauffeur">Chauffeur</option>
                      <option value="client">Client</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                  <div className="relative">
                    <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2B2321]/30" />
                    <select 
                      className="pl-12 pr-8 py-3 bg-white border border-secondary/30 rounded-2xl outline-none focus:border-primary transition-all font-bold text-[10px] md:text-xs uppercase tracking-widest appearance-none cursor-pointer h-full"
                      value={filterAction}
                      onChange={(e) => setFilterAction(e.target.value)}
                    >
                      <option value="all">Toutes les actions</option>
                      <option value="Connexion">Connexions & Sessions</option>
                      <option value="Vente">Ventes & Encaissements</option>
                      <option value="Chambre">Chambres & Hébergement</option>
                      <option value="Check-In">Check-In</option>
                      <option value="Check-Out">Check-Out</option>
                      <option value="Stock">Mouvements de Stock</option>
                      <option value="Validation Dépense">Dépenses & Caisses</option>
                      <option value="Fermeture de Caisse">Clôtures de caisse</option>
                    </select>
                  </div>
                </div>
                <div className="flex bg-[#FDFBF7] border border-secondary/20 rounded-xl p-1 self-start xl:self-auto h-[46px]">
                  <button
                    onClick={() => setGroupBy('day')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center h-full ${groupBy === 'day' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
                  >
                    Jour
                  </button>
                  <button
                    onClick={() => setGroupBy('week')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center h-full ${groupBy === 'week' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
                  >
                    Semaine
                  </button>
                  <button
                    onClick={() => setGroupBy('month')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center h-full ${groupBy === 'month' ? 'bg-primary text-white shadow-sm' : 'text-primary/60 hover:text-primary'}`}
                  >
                    Mois
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-white rounded-[2rem] border border-secondary/30 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FDFBF7] border-bottom border-secondary/20">
                        <th className="px-6 py-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/40">Utilisateur</th>
                        <th className="px-6 py-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/40">Action</th>
                        <th className="px-6 py-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/40">Détails</th>
                        <th className="px-6 py-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/40">Date & Heure</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary/10">
                      {sortedGroupKeys.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-[#2B2321]/40 italic">
                            Aucun log trouvé
                          </td>
                        </tr>
                      ) : (
                          sortedGroupKeys.map(groupKey => {
                            const isExpanded = expandedGroups.includes(groupKey);
                            const groupItems = groupedLogs[groupKey];
                            
                            let displayKey = groupKey;
                            if (groupBy === 'day' && groupKey !== 'Inconnu') {
                              try {
                                displayKey = format(new Date(groupKey), 'EEEE d MMMM yyyy', { locale: fr });
                              } catch (e) {}
                            } else if (groupBy === 'month' && groupKey !== 'Inconnu') {
                              displayKey = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
                            }

                            return (
                              <React.Fragment key={groupKey}>
                                <tr className="bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => toggleGroup(groupKey)}>
                                  <td colSpan={4} className="p-3 md:p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                          <Calendar className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <p className="font-bold text-[#2B2321] capitalize text-sm">{displayKey}</p>
                                          <p className="text-[10px] text-primary/60 font-bold tracking-widest uppercase mt-0.5">
                                            {groupItems.length} événement{groupItems.length > 1 ? 's' : ''}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-primary/40 mr-4">
                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded && groupItems.map((log) => (
                                  <motion.tr 
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    key={log.id} 
                                    onClick={() => setSelectedLog(log)}
                                    className="hover:bg-[#FDFBF7] cursor-pointer transition-colors group"
                                  >
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] md:text-xs font-bold text-[#2B2321]/60">
                                          {log.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="text-[10px] md:text-sm font-bold text-[#2B2321]">{log.username}</p>
                                          <span className={cn("text-[8px] px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-tighter", getRoleColor(log.userRole))}>
                                            {log.userRole}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <span className={cn(
                                        "text-[10px] md:text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md inline-flex items-center gap-1",
                                        log.action === 'Connexion' 
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                                          : log.action === 'Déconnexion'
                                          ? "bg-slate-100 text-slate-700 border border-slate-300"
                                          : "text-primary"
                                      )}>
                                        {log.action === 'Connexion' && <KeyRound className="w-3 h-3 text-emerald-600 shrink-0" />}
                                        {log.action === 'Déconnexion' && <LogOut className="w-3 h-3 text-slate-500 shrink-0" />}
                                        {log.action}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                      {log.action === 'Connexion' ? (() => {
                                        const parsed = parseConnectionLog(log.details);
                                        return (
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1 max-w-md">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                                  {parsed.actionSummary || 'Session ouverte'}
                                                </span>
                                                {parsed.location && (
                                                  <span className="text-[9px] font-semibold text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                                                    {parsed.location}
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[11px] text-[#2B2321]/80 font-medium line-clamp-2">
                                                {parsed.scope || (parsed.account ? `Compte: ${parsed.account}` : log.details)}
                                              </p>
                                              {parsed.terminal && (
                                                <p className="text-[9px] text-[#2B2321]/50 font-medium flex items-center gap-1">
                                                  <Laptop className="w-2.5 h-2.5 text-primary/50 shrink-0" />
                                                  {parsed.terminal}
                                                </p>
                                              )}
                                            </div>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedLog(log);
                                              }}
                                              title="Voir tous les détails de connexion"
                                              className="text-primary/40 hover:text-primary transition-colors shrink-0 p-1 cursor-pointer"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                          </div>
                                        );
                                      })() : log.action === 'Déconnexion' ? (() => {
                                        return (
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-0.5 max-w-md">
                                              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                                <LogOut className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                                Fermeture de session
                                              </span>
                                              <p className="text-[11px] text-[#2B2321]/80 font-medium line-clamp-1 mt-0.5">
                                                {log.details}
                                              </p>
                                            </div>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedLog(log);
                                              }}
                                              className="text-primary/40 hover:text-primary transition-colors shrink-0 p-1 cursor-pointer"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                          </div>
                                        );
                                      })() : (
                                        <div className="flex items-center gap-2">
                                          <p className="text-[10px] md:text-xs text-[#2B2321]/80 font-medium max-w-md line-clamp-2">
                                            {log.details}
                                          </p>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedLog(log);
                                            }}
                                            className="text-[#2B2321]/30 hover:text-primary transition-colors shrink-0 p-1 cursor-pointer"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] md:text-xs font-bold text-[#2B2321]">
                                          {log.timestamp ? format(log.timestamp.toDate(), 'dd MMM yyyy', { locale: fr }) : '-'}
                                        </span>
                                        <span className="text-[8px] md:text-[10px] text-[#2B2321]/40 font-medium">
                                          {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss') : '-'}
                                        </span>
                                      </div>
                                    </td>
                                  </motion.tr>
                                ))}
                              </React.Fragment>
                            );
                          })
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sessions.map(session => {
                const online = isOnline(session.lastActive);
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={session.id} 
                    className="bg-white p-6 rounded-[2rem] border border-secondary/30 shadow-sm space-y-4 relative overflow-hidden group"
                  >
                    <div className={cn(
                      "absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform group-hover:scale-110",
                      online ? "bg-green-500" : "bg-gray-500"
                    )}></div>
                    
                    <div className="flex items-start justify-between">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center text-2xl font-bold text-[#2B2321]/60">
                          {session.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-5 h-5 border-4 border-white rounded-full",
                          online ? "bg-green-500" : "bg-gray-300"
                        )}></div>
                      </div>
                      <div className={cn("text-[8px] md:text-[10px] px-3 py-1 rounded-full border font-bold uppercase tracking-widest", getRoleColor(session.role))}>
                        {session.role}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-bold text-[#2B2321]">{session.username}</h4>
                      <p className="text-[10px] md:text-xs text-[#2B2321]/40 font-medium flex items-center gap-1.5 mt-1">
                        <Clock className="w-3 h-3" />
                        {online ? "Actif maintenant" : `Dernière activité: ${session.lastActive ? format(session.lastActive.toDate(), 'HH:mm') : 'Inconnu'}`}
                      </p>
                    </div>

                    <div className="pt-4 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-secondary/20 rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all duration-1000", online ? "w-full bg-green-500" : "w-0 bg-gray-300")}></div>
                      </div>
                      <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-[#2B2321]/40">
                        {online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Log Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-secondary/30 space-y-6 relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setSelectedLog(null)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-secondary/10 hover:bg-secondary/20 flex items-center justify-center text-primary transition-colors cursor-pointer z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0",
                  selectedLog.action === 'Connexion' 
                    ? "bg-emerald-100 text-emerald-700" 
                    : selectedLog.action === 'Déconnexion'
                    ? "bg-slate-100 text-slate-700"
                    : "bg-primary/10 text-primary"
                )}>
                  {selectedLog.action === 'Connexion' ? (
                    <KeyRound className="w-6 h-6 text-emerald-600" />
                  ) : selectedLog.action === 'Déconnexion' ? (
                    <LogOut className="w-6 h-6 text-slate-600" />
                  ) : (
                    <Info className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md",
                      selectedLog.action === 'Connexion' 
                        ? "bg-emerald-100 text-emerald-800" 
                        : selectedLog.action === 'Déconnexion'
                        ? "bg-slate-100 text-slate-700"
                        : "bg-primary/10 text-primary"
                    )}>
                      {selectedLog.action}
                    </span>
                    <span className={cn("text-[9px] px-2 py-0.5 rounded-md border font-bold uppercase tracking-wider", getRoleColor(selectedLog.userRole))}>
                      {selectedLog.userRole}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#2B2321] mt-1">{selectedLog.username}</h3>
                </div>
              </div>

              {selectedLog.action === 'Connexion' ? (() => {
                const parsed = parseConnectionLog(selectedLog.details);
                return (
                  <div className="space-y-4">
                    {/* Header banner */}
                    <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-emerald-950">Prise de Poste & Authentification Réussie</h4>
                          <p className="text-[11px] text-emerald-700 font-medium">Session de travail active validée sur le système</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-1 rounded-full shrink-0">
                        Session Active
                      </span>
                    </div>

                    {/* Breakdown grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20 space-y-1">
                        <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block">Action Menée</span>
                        <p className="text-xs font-bold text-[#2B2321]">{parsed.actionSummary || "Authentification & Prise de poste"}</p>
                      </div>

                      <div className="p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20 space-y-1">
                        <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block">Poste & Rôle</span>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[#2B2321]">{parsed.roleTitle || selectedLog.userRole}</p>
                          <span className={cn("text-[8px] px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-wider", getRoleColor(selectedLog.userRole))}>
                            {selectedLog.userRole}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20 space-y-1">
                        <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block">Affectation / Lieu</span>
                        <p className="text-xs font-bold text-[#2B2321] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          {parsed.location || "Établissement Principal"}
                        </p>
                      </div>

                      <div className="p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20 space-y-1">
                        <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block">Terminal & Navigateur</span>
                        <p className="text-xs font-bold text-[#2B2321] flex items-center gap-1.5 truncate" title={parsed.terminal}>
                          <Laptop className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{parsed.terminal || "Poste Informatique"}</span>
                        </p>
                      </div>

                      <div className="p-3 bg-[#FDFBF7] rounded-xl border border-secondary/20 space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest block">Compte & Identifiant</span>
                        <p className="text-xs font-bold text-[#2B2321]">
                          {parsed.account || `${selectedLog.username} (${selectedLog.userId})`}
                        </p>
                      </div>

                      {parsed.scope && (
                        <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/10 space-y-1 sm:col-span-2">
                          <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest block">Périmètre & Habilitations</span>
                          <p className="text-xs text-[#2B2321]/90 font-medium leading-relaxed">
                            {parsed.scope}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Raw formatted audit block */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-1">
                      <span className="font-bold text-slate-500 uppercase tracking-wider block">Texte Enregistré dans l'Audit</span>
                      <pre className="font-mono text-slate-700 whitespace-pre-wrap leading-relaxed select-all">
                        {selectedLog.details}
                      </pre>
                    </div>
                  </div>
                );
              })() : selectedLog.action === 'Déconnexion' ? (() => {
                return (
                  <div className="space-y-3">
                    <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Fermeture de Session</h4>
                        <p className="text-[11px] text-slate-600 font-medium">L'utilisateur a clos sa session sur ce terminal</p>
                      </div>
                    </div>
                    <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-secondary/20 space-y-2">
                      <p className="text-xs font-bold text-primary/60 uppercase tracking-widest">Détails de Déconnexion</p>
                      <p className="text-xs md:text-sm text-[#2B2321] leading-relaxed font-medium whitespace-pre-wrap">
                        {selectedLog.details}
                      </p>
                    </div>
                  </div>
                );
              })() : (
                <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-secondary/20 space-y-3">
                  <p className="text-xs font-bold text-primary/60 uppercase tracking-widest">Détails de l'Action / Événement</p>
                  <p className="text-xs md:text-sm text-[#2B2321] leading-relaxed font-medium whitespace-pre-wrap">
                    {selectedLog.details}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs bg-secondary/5 p-3.5 rounded-2xl border border-secondary/15">
                <div>
                  <span className="text-[10px] text-[#2B2321]/50 font-bold uppercase block mb-0.5">Horodatage Précis</span>
                  <span className="font-bold text-[#2B2321]">
                    {selectedLog.timestamp ? format(selectedLog.timestamp.toDate(), 'dd/MM/yyyy à HH:mm:ss', { locale: fr }) : 'Non spécifié'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#2B2321]/50 font-bold uppercase block mb-0.5">Identifiant unique</span>
                  <span className="font-mono text-[10px] text-primary truncate block">
                    #{selectedLog.id}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2.5 bg-[#1C2321] text-white rounded-xl text-xs font-bold hover:bg-black transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
