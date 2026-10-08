import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, getDocs, where, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Room, Hall, UserProfile, MaintenanceTask, MonthlyMaintenanceTask, DailyMaintenanceChecklist, GEDailyData, BacheDailyData, PoolDailyData, AppSettings } from '../types';
import { 
  Camera, CheckCircle, XCircle, Clock, Image as ImageIcon, Loader2, LayoutGrid, Bed, Wrench, Plus, Compass, Check, X, 
  Trash2, Calendar, User, Eye, FileText, Zap, Droplets, Waves, AlertTriangle, Gauge, CheckSquare, ChevronRight, Sliders, 
  RefreshCw, Layers, ShieldCheck, Filter, Download, ArrowRight, Play, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType, cn, logEvent, parseDate } from '../lib/utils';
import { exportMaintenanceReportPDF } from '../lib/pdfUtils';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface MaintenanceManagementProps {
  user: UserProfile;
  rooms: Room[];
  halls: Hall[];
  settings?: AppSettings | null;
}

export const MaintenanceManagement: React.FC<MaintenanceManagementProps> = ({ user, rooms, halls, settings }) => {
  // Top level module tab: 'tickets' | 'planning' | 'checklists'
  const [activeModuleTab, setActiveModuleTab] = useState<'tickets' | 'planning' | 'checklists'>('tickets');

  // PDF Export States
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfPeriodType, setPdfPeriodType] = useState<'day' | 'week' | 'month'>('day');
  const [pdfPeriodValue, setPdfPeriodValue] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const handleExportPDF = () => {
    let filteredTasks = tasks;
    let filteredMonthly = monthlyTasks;
    let filteredDaily = dailyHistory;

    if (pdfPeriodType === 'day') {
      filteredTasks = tasks.filter(t => {
        const d = t.timestamp ? parseDate(t.timestamp) : null;
        return d && format(d, 'yyyy-MM-dd') === pdfPeriodValue;
      });
      filteredMonthly = monthlyTasks.filter(mt => mt.scheduledDate === pdfPeriodValue);
      filteredDaily = dailyHistory.filter(dc => dc.date === pdfPeriodValue);
    } else if (pdfPeriodType === 'month') {
      filteredTasks = tasks.filter(t => {
        const d = t.timestamp ? parseDate(t.timestamp) : null;
        return d && format(d, 'yyyy-MM') === pdfPeriodValue;
      });
      filteredMonthly = monthlyTasks.filter(mt => mt.targetMonth === pdfPeriodValue);
      filteredDaily = dailyHistory.filter(dc => dc.date.startsWith(pdfPeriodValue));
    }

    exportMaintenanceReportPDF({
      periodType: pdfPeriodType,
      periodValue: pdfPeriodValue,
      tasks: filteredTasks,
      monthlyTasks: filteredMonthly,
      dailyChecklists: filteredDaily,
      settings: settings || null
    });
    setIsExportingPDF(false);
    toast.success("Rapport technique PDF généré avec succès !");
  };

  // ==================== TICKETS / INTERVENTIONS STATE ====================
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'NeedSubmitted' | 'Pending' | 'Accepted' | 'Validated' | 'Rejected'>('All');
  
  // Ticket form states
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedLocationType, setSelectedLocationType] = useState<'room' | 'hall' | 'other'>('room');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedHallId, setSelectedHallId] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [note, setNote] = useState('');
  
  const [photoBefore, setPhotoBefore] = useState<string | null>(null);
  const [photoAfter, setPhotoAfter] = useState<string | null>(null);
  const [isPartReplacement, setIsPartReplacement] = useState(false);

  // States for final task completion
  const [completionPhotoBefore, setCompletionPhotoBefore] = useState<string | null>(null);
  const [completionPhotoAfter, setCompletionPhotoAfter] = useState<string | null>(null);
  const [completionComment, setCompletionComment] = useState('');
  const [completionCost, setCompletionCost] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const completionFileBeforeRef = useRef<HTMLInputElement>(null);
  const completionFileAfterRef = useRef<HTMLInputElement>(null);
  
  const [cost, setCost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingTask, setViewingTask] = useState<MaintenanceTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<MaintenanceTask | null>(null);

  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);

  // ==================== PLANNING MENSUEL STATE ====================
  const [monthlyTasks, setMonthlyTasks] = useState<MonthlyMaintenanceTask[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [equipmentFilter, setEquipmentFilter] = useState<'Tous' | 'Split' | 'Bache_Eau' | 'Groupe_Electrogene' | 'Autre'>('Tous');
  
  const [isAddingMonthlyTask, setIsAddingMonthlyTask] = useState(false);
  const [monthlyEquipmentType, setMonthlyEquipmentType] = useState<'Split' | 'Bache_Eau' | 'Groupe_Electrogene' | 'Autre'>('Split');
  const [monthlyTitle, setMonthlyTitle] = useState('');
  const [monthlyLocation, setMonthlyLocation] = useState('');
  const [monthlyScheduledDate, setMonthlyScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [monthlyDescription, setMonthlyDescription] = useState('');
  const [isSubmittingMonthly, setIsSubmittingMonthly] = useState(false);

  const [completingMonthlyTask, setCompletingMonthlyTask] = useState<MonthlyMaintenanceTask | null>(null);
  const [monthlyReportNotes, setMonthlyReportNotes] = useState('');
  const [monthlyTaskToDelete, setMonthlyTaskToDelete] = useState<string | null>(null);

  // ==================== CHECKLISTS JOURNALIÈRES STATE ====================
  const [dailyHistory, setDailyHistory] = useState<DailyMaintenanceChecklist[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isSavingDaily, setIsSavingDaily] = useState(false);
  const [activeChecklistSection, setActiveChecklistSection] = useState<'all' | 'ge' | 'bache'>('all');

  // Daily GE State (Multi-Generators Support)
  const DEFAULT_GENERATORS: GEDailyData[] = [
    {
      id: 'ge-1',
      name: 'Groupe Principal (250 kVA)',
      fuelLevelPercent: 80,
      fuelLevelLiters: 400,
      engineHours: 1200,
      oilLevel: 'OK',
      batteryStatus: 'OK',
      generalStatus: 'OK',
      notes: ''
    },
    {
      id: 'ge-2',
      name: 'Groupe Secours / Secondaire (100 kVA)',
      fuelLevelPercent: 75,
      fuelLevelLiters: 150,
      engineHours: 650,
      oilLevel: 'OK',
      batteryStatus: 'OK',
      generalStatus: 'OK',
      notes: ''
    }
  ];

  const [generators, setGenerators] = useState<GEDailyData[]>(DEFAULT_GENERATORS);
  const [activeGeIndex, setActiveGeIndex] = useState<number>(0);
  const [isAddingNewGeModalOpen, setIsAddingNewGeModalOpen] = useState(false);
  const [newGeName, setNewGeName] = useState('');
  const [newGeCapacity, setNewGeCapacity] = useState('300');

  // Daily Bâche à Eau State
  const [bacheWaterClarity, setBacheWaterClarity] = useState<'Limpide' | 'Légèrement trouble' | 'Trouble'>('Limpide');
  const [bacheLevelPercent, setBacheLevelPercent] = useState<number>(85);
  const [bachePumpStatus, setBachePumpStatus] = useState<'Normal' | 'Avertissement' | 'Panne'>('Normal');
  const [bachePressure, setBachePressure] = useState<number>(3.5);
  const [bacheNotes, setBacheNotes] = useState<string>('');

  const canReport = true;
  const canValidate = ['admin', 'manager'].includes(user.role);
  const isMaintenanceOperator = ['maintenance', 'admin', 'manager'].includes(user.role);

  // 1. Fetch Maintenance Tasks (Tickets)
  useEffect(() => {
    const q = query(collection(db, 'maintenance_tasks'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceTask)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'maintenance_tasks');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Monthly Maintenance Schedules
  useEffect(() => {
    const q = query(collection(db, 'maintenance_schedules'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMonthlyTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyMaintenanceTask)));
      setLoadingMonthly(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'maintenance_schedules');
      setLoadingMonthly(false);
    });
    return () => unsub();
  }, []);

  // 3. Fetch Daily Maintenance Checklists
  useEffect(() => {
    const q = query(collection(db, 'maintenance_daily_checklists'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyMaintenanceChecklist));
      setDailyHistory(records);
      setLoadingDaily(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'maintenance_daily_checklists');
      setLoadingDaily(false);
    });
    return () => unsub();
  }, []);

  // Generator helper functions
  const updateGeneratorField = (index: number, field: keyof GEDailyData, value: any) => {
    setGenerators(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };
      if (field === 'fuelLevelPercent') {
        const capacity = current.fuelLevelLiters ? Math.round((current.fuelLevelLiters / (updated[index].fuelLevelPercent || 100)) * 100) : 500;
        current.fuelLevelLiters = Math.round(((value as number) / 100) * (capacity || 500));
      }
      updated[index] = current;
      return updated;
    });
  };

  const handleAddNewGenerator = () => {
    if (!newGeName.trim()) {
      toast.error("Veuillez entrer le nom du groupe électrogène (ex: GE #3 - VIP / Terrasse)");
      return;
    }
    const cap = Number(newGeCapacity) || 300;
    const newGe: GEDailyData = {
      id: `ge-${Date.now()}`,
      name: newGeName.trim(),
      fuelLevelPercent: 80,
      fuelLevelLiters: Math.round(0.8 * cap),
      engineHours: 0,
      oilLevel: 'OK',
      batteryStatus: 'OK',
      generalStatus: 'OK',
      notes: ''
    };
    setGenerators(prev => [...prev, newGe]);
    setActiveGeIndex(generators.length);
    setNewGeName('');
    setIsAddingNewGeModalOpen(false);
    toast.success(`Nouveau Groupe Électrogène "${newGe.name}" ajouté avec succès !`);
  };

  const handleRemoveGenerator = (indexToRemove: number) => {
    if (generators.length <= 1) {
      toast.error("Au moins un groupe électrogène doit être conservé dans le système.");
      return;
    }
    const name = generators[indexToRemove].name || 'Groupe';
    setGenerators(prev => prev.filter((_, i) => i !== indexToRemove));
    if (activeGeIndex >= indexToRemove && activeGeIndex > 0) {
      setActiveGeIndex(activeGeIndex - 1);
    }
    toast.info(`Groupe "${name}" retiré de la liste.`);
  };

  // When selectedDailyDate or dailyHistory changes, load data for that day into form
  useEffect(() => {
    const existingRecord = dailyHistory.find(d => d.date === selectedDailyDate);
    if (existingRecord) {
      if (existingRecord.geDataList && existingRecord.geDataList.length > 0) {
        setGenerators(existingRecord.geDataList);
      } else if (existingRecord.geData) {
        setGenerators([
          {
            id: 'ge-1',
            name: 'Groupe Principal (250 kVA)',
            ...existingRecord.geData
          },
          {
            id: 'ge-2',
            name: 'Groupe Secours / Secondaire (100 kVA)',
            fuelLevelPercent: 75,
            fuelLevelLiters: 150,
            engineHours: 650,
            oilLevel: 'OK',
            batteryStatus: 'OK',
            generalStatus: 'OK',
            notes: ''
          }
        ]);
      } else {
        setGenerators(DEFAULT_GENERATORS);
      }

      if (existingRecord.bacheData) {
        setBacheWaterClarity(existingRecord.bacheData.waterClarity || 'Limpide');
        setBacheLevelPercent(existingRecord.bacheData.waterLevelPercent ?? 85);
        setBachePumpStatus(existingRecord.bacheData.pumpStatus || 'Normal');
        setBachePressure(existingRecord.bacheData.pressureBar ?? 3.5);
        setBacheNotes(existingRecord.bacheData.notes || '');
      }
    } else {
      setGenerators(DEFAULT_GENERATORS);
    }
  }, [selectedDailyDate, dailyHistory]);

  const handleResizeAndCompressImage = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 450;
        const MAX_HEIGHT = 450;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
        callback(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 0.5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux ! La photo doit être inférieure à 0,5 Mo.");
      e.target.value = '';
      return;
    }

    handleResizeAndCompressImage(file, (base64) => {
      if (type === 'before') {
        setPhotoBefore(base64);
      } else {
        setPhotoAfter(base64);
      }
    });
  };

  const handleCompletionPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 0.5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux ! La photo doit être inférieure à 0,5 Mo.");
      e.target.value = '';
      return;
    }

    handleResizeAndCompressImage(file, (base64) => {
      if (type === 'before') {
        setCompletionPhotoBefore(base64);
      } else {
        setCompletionPhotoAfter(base64);
      }
    });
  };

  // ================= TICKET HANDLERS =================
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) {
      toast.error('Veuillez entrer une description des travaux.');
      return;
    }
    const finalPhotoBefore = photoBefore || '';
    const finalPhotoAfter = photoAfter || '';

    setIsSubmitting(true);

    let finalLocation = '';
    let targetRoomRefId = '';
    let targetHallRefId = '';

    if (selectedLocationType === 'room') {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (!room) {
        toast.error('Veuillez sélectionner une chambre.');
        setIsSubmitting(false);
        return;
      }
      finalLocation = `Chambre ${room.number}`;
      targetRoomRefId = room.id;
    } else if (selectedLocationType === 'hall') {
      const hall = halls.find(h => h.id === selectedHallId);
      if (!hall) {
        toast.error('Veuillez sélectionner une salle.');
        setIsSubmitting(false);
        return;
      }
      finalLocation = `Salle "${hall.name}"`;
      targetHallRefId = hall.id;
    } else {
      if (!customLocation) {
        toast.error('Veuillez spécifier le lieu des travaux.');
        setIsSubmitting(false);
        return;
      }
      finalLocation = customLocation;
    }

    try {
      const finalCost = cost ? Number(cost) : 0;
      if (cost && (isNaN(finalCost) || finalCost < 0)) {
        toast.error('Veuillez entrer un montant de dépense valide (supérieur ou égal à 0).');
        setIsSubmitting(false);
        return;
      }

      const taskRef = doc(collection(db, 'maintenance_tasks'));
      const expenseRef = doc(collection(db, 'expenses'));

      const taskData: any = {
        location: finalLocation,
        note,
        photoBefore: finalPhotoBefore,
        photoAfter: finalPhotoAfter || '',
        status: 'NeedSubmitted',
        reporterId: user.id,
        reporterName: user.username,
        timestamp: serverTimestamp(),
        isPartReplacement: isPartReplacement
      };

      if (finalCost > 0) {
        taskData.cost = finalCost;
        taskData.expenseId = expenseRef.id;
      }

      const batch = writeBatch(db);
      
      batch.set(taskRef, taskData);

      if (finalCost > 0) {
        batch.set(expenseRef, {
          description: `Maintenance : ${finalLocation} - ${note}`,
          amount: finalCost,
          category: 'Maintenance',
          timestamp: serverTimestamp(),
          recordedBy: user.username,
          recordedById: user.id,
          status: user.role === 'admin' || user.role === 'manager' ? 'Approved' : 'Pending',
          maintenanceTaskId: taskRef.id,
          ...(user.role === 'admin' || user.role === 'manager' ? { validatedBy: user.username } : {})
        });
      }

      if (selectedLocationType === 'room' && targetRoomRefId) {
        batch.update(doc(db, 'rooms', targetRoomRefId), { status: 'Maintenance' });
      } else if (selectedLocationType === 'hall' && targetHallRefId) {
        batch.update(doc(db, 'halls', targetHallRefId), { status: 'Maintenance' });
      }

      await batch.commit();

      await addDoc(collection(db, 'notifications'), {
        type: 'maintenance',
        message: `Demande de Remplacement: ${finalLocation}, ${note}` + (finalCost > 0 ? ` (Dépense: ${finalCost.toLocaleString()} FCFA)` : ''),
        timestamp: serverTimestamp(),
        readBy: [],
        maintenanceTaskId: taskRef.id
      });

      logEvent(user, 'Maintenance Interventions', `Signalement créé pour ${finalLocation}: ${note}`);
      toast.success('Travail de maintenance soumis avec succès.');
      
      setIsAddingTask(false);
      setNote('');
      setCost('');
      setPhotoBefore(null);
      setPhotoAfter(null);
      setIsPartReplacement(false);
      setCustomLocation('');
      setSelectedRoomId('');
      setSelectedHallId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'maintenance_tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidateReplacement = async (task: MaintenanceTask, isApproved: boolean) => {
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'maintenance_tasks', task.id), {
        status: isApproved ? 'Pending' : 'Rejected',
        materialApprovedBy: user.username,
        materialApprovedById: user.id,
        materialApprovedAt: serverTimestamp(),
        ...(!isApproved ? {
          validatedBy: user.username,
          validatedById: user.id,
          validatedAt: serverTimestamp()
        } : {})
      });

      if (!isApproved) {
        if (task.location.startsWith('Chambre ')) {
          const roomNumberStr = task.location.replace('Chambre ', '');
          const matchingRoom = rooms.find(r => r.number === roomNumberStr);
          if (matchingRoom) {
            batch.update(doc(db, 'rooms', matchingRoom.id), { status: 'Available' });
          }
        } else if (task.location.startsWith('Salle "')) {
          const hallNameStr = task.location.substring(7, task.location.length - 1);
          const matchingHall = halls.find(h => h.name === hallNameStr);
          if (matchingHall) {
            batch.update(doc(db, 'halls', matchingHall.id), { status: 'Available' });
          }
        }
      }

      await batch.commit();

      const qNotif = query(collection(db, 'notifications'), where('maintenanceTaskId', '==', task.id));
      const scanNotif = await getDocs(qNotif);
      const delBatch = writeBatch(db);
      scanNotif.docs.forEach((docSnap) => {
        delBatch.delete(docSnap.ref);
      });
      await delBatch.commit();

      logEvent(user, 'Maintenance Interventions', `Matériel pour ${task.location} ${isApproved ? 'approuvé' : 'rejeté'}.`);
      toast.success(isApproved ? "Matériel validé ! Tâche en attente de réalisation." : "Besoin rejeté.");
      setViewingTask(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `maintenance_tasks/${task.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptTask = async (task: MaintenanceTask) => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'maintenance_tasks', task.id), {
        status: 'Accepted',
        acceptedBy: user.username,
        acceptedById: user.id,
        acceptedAt: serverTimestamp()
      });
      toast.success("Tâche prise en charge.");
      setViewingTask(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `maintenance_tasks/${task.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTask = async (task: MaintenanceTask) => {
    setIsSubmittingCompletion(true);
    try {
      const finalCost = completionCost ? Number(completionCost) : (task.cost || 0);
      if (completionCost && (isNaN(finalCost) || finalCost < 0)) {
        toast.error('Veuillez entrer un montant de dépense valide.');
        setIsSubmittingCompletion(false);
        return;
      }

      const batch = writeBatch(db);
      const finalNote = completionComment 
        ? `${task.note} (Note finale: ${completionComment})`
        : task.note;

      let targetExpenseId = task.expenseId || '';

      if (finalCost > 0) {
        if (!targetExpenseId) {
          const expenseRef = doc(collection(db, 'expenses'));
          targetExpenseId = expenseRef.id;
          
          batch.set(expenseRef, {
            description: `Maintenance : ${task.location} - ${finalNote}`,
            amount: finalCost,
            category: 'Maintenance',
            timestamp: serverTimestamp(),
            recordedBy: user.username,
            recordedById: user.id,
            status: user.role === 'admin' || user.role === 'manager' ? 'Approved' : 'Pending',
            maintenanceTaskId: task.id,
            ...(user.role === 'admin' || user.role === 'manager' ? { validatedBy: user.username } : {})
          });
        } else {
          batch.update(doc(db, 'expenses', targetExpenseId), {
            amount: finalCost,
            description: `Maintenance : ${task.location} - ${finalNote}`,
            recordedBy: user.username,
            recordedById: user.id,
            timestamp: serverTimestamp()
          });
        }
      }

      if (task.isPartReplacement && (!completionPhotoBefore || !completionPhotoAfter)) {
        toast.error("Veuillez insérer les photos avant et après pour le remplacement de pièce.");
        setIsSubmittingCompletion(false);
        return;
      }

      const taskUpdatePayload: any = {
        status: 'Validated',
        photoBefore: task.isPartReplacement ? (completionPhotoBefore || task.photoBefore) : task.photoBefore,
        photoAfter: completionPhotoAfter || task.photoAfter || '',
        note: finalNote,
        validatedBy: user.username,
        validatedById: user.id,
        validatedAt: serverTimestamp()
      };

      if (finalCost > 0) {
        taskUpdatePayload.cost = finalCost;
        taskUpdatePayload.expenseId = targetExpenseId;
      }

      batch.update(doc(db, 'maintenance_tasks', task.id), taskUpdatePayload);

      if (task.location.startsWith('Chambre ')) {
        const roomNumberStr = task.location.replace('Chambre ', '');
        const matchingRoom = rooms.find(r => r.number === roomNumberStr);
        if (matchingRoom) {
          batch.update(doc(db, 'rooms', matchingRoom.id), { status: 'Available' });
        }
      } else if (task.location.startsWith('Salle "')) {
        const hallNameStr = task.location.substring(7, task.location.length - 1);
        const matchingHall = halls.find(h => h.name === hallNameStr);
        if (matchingHall) {
          batch.update(doc(db, 'halls', matchingHall.id), { status: 'Available' });
        }
      }

      await batch.commit();
      logEvent(user, 'Maintenance Interventions', `Tâche résolue pour ${task.location}`);
      toast.success("Tâche de maintenance résolue et clôturée !");
      setViewingTask(null);
      setCompletionPhotoBefore(null);
      setCompletionPhotoAfter(null);
      setCompletionComment('');
      setCompletionCost('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `maintenance_tasks/${task.id}`);
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const executeDeleteTask = async () => {
    if (!taskToDelete) return;
    const taskId = taskToDelete.id;
    try {
      const matchingTask = tasks.find(t => t.id === taskId);
      const delBatch = writeBatch(db);

      delBatch.delete(doc(db, 'maintenance_tasks', taskId));

      if (matchingTask?.expenseId) {
        delBatch.delete(doc(db, 'expenses', matchingTask.expenseId));
      }
      
      const qNotif = query(collection(db, 'notifications'), where('maintenanceTaskId', '==', taskId));
      const scanNotif = await getDocs(qNotif);
      scanNotif.docs.forEach((docSnap) => {
        delBatch.delete(docSnap.ref);
      });
      
      await delBatch.commit();
      toast.success('Enregistrement supprimé.');
      setViewingTask(null);
      setTaskToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `maintenance_tasks/${taskId}`);
    }
  };

  // ================= PLANNING MENSUEL HANDLERS =================
  const handleGenerateStandardMonthlyPlanning = async () => {
    setIsSubmittingMonthly(true);
    try {
      const batch = writeBatch(db);
      const monthLabel = selectedMonth;

      const defaultItems: any[] = [
        {
          equipmentType: 'Split' as const,
          title: 'Nettoyage & Entretien des Splits',
          location: 'Tous les Bâtiments (Chambres & Salles)',
          description: 'Nettoyage approfondi des filtres à air, vérification pression gaz réfrigérant, écoulement des condensats et désinfection évaporateurs.'
        },
        {
          equipmentType: 'Bache_Eau' as const,
          title: 'Nettoyage & Désinfection Bâche à Eau',
          location: 'Bâche à Eau Principale',
          description: 'Vidange partielle/inspection cuve, contrôle d\'étanchéité, nettoyage du clapet de pied, révision des surpresseurs et filtres.'
        }
      ];

      // Generate a task for each generator in generators
      for (const ge of generators) {
        defaultItems.push({
          equipmentType: 'Groupe_Electrogene' as const,
          title: `Révision Mensuelle ${ge.name || 'Groupe Électrogène'}`,
          location: `Local GE - ${ge.name || 'Groupe Électrogène'}`,
          description: 'Vidange huile moteur, remplacement/nettoyage filtres (huile, gazole, air), contrôle tension courroies, batterie et niveau gazole.'
        });
      }

      for (const item of defaultItems) {
        // Check if item already exists for this month
        const exists = monthlyTasks.some(t => t.targetMonth === monthLabel && t.title === item.title);
        if (!exists) {
          const newDocRef = doc(collection(db, 'maintenance_schedules'));
          batch.set(newDocRef, {
            ...item,
            targetMonth: monthLabel,
            scheduledDate: `${monthLabel}-15`,
            status: 'Scheduled',
            createdAt: serverTimestamp(),
            createdById: user.id,
            createdByName: user.username
          });
        }
      }

      await batch.commit();
      logEvent(user, 'Planning Mensuel', `Génération automatique du planning mensuel pour ${monthLabel}`);
      toast.success(`Planning mensuel pour ${monthLabel} généré avec succès !`);
    } catch (error) {
      console.error("Error generating monthly planning:", error);
      toast.error("Erreur lors de la génération du planning.");
    } finally {
      setIsSubmittingMonthly(false);
    }
  };

  const handleAddMonthlyTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthlyTitle || !monthlyLocation) {
      toast.error("Veuillez remplir le titre et le lieu.");
      return;
    }
    setIsSubmittingMonthly(true);
    try {
      await addDoc(collection(db, 'maintenance_schedules'), {
        equipmentType: monthlyEquipmentType,
        title: monthlyTitle,
        location: monthlyLocation,
        targetMonth: selectedMonth,
        scheduledDate: monthlyScheduledDate,
        description: monthlyDescription,
        status: 'Scheduled',
        createdAt: serverTimestamp(),
        createdById: user.id,
        createdByName: user.username
      });

      logEvent(user, 'Planning Mensuel', `Ajout maintenance mensuelle: ${monthlyTitle} (${selectedMonth})`);
      toast.success("Maintenance mensuelle programmée !");
      setIsAddingMonthlyTask(false);
      setMonthlyTitle('');
      setMonthlyLocation('');
      setMonthlyDescription('');
    } catch (error) {
      console.error("Error adding monthly schedule:", error);
      toast.error("Erreur d'enregistrement.");
    } finally {
      setIsSubmittingMonthly(false);
    }
  };

  const handleCompleteMonthlyTask = async () => {
    if (!completingMonthlyTask) return;
    setIsSubmittingMonthly(true);
    try {
      await updateDoc(doc(db, 'maintenance_schedules', completingMonthlyTask.id), {
        status: 'Completed',
        completedAt: serverTimestamp(),
        completedBy: user.username,
        reportNotes: monthlyReportNotes
      });

      logEvent(user, 'Planning Mensuel', `Maintenance réalisée: ${completingMonthlyTask.title}`);
      toast.success("Maintenance mensuelle marquée comme Réalisée !");
      setCompletingMonthlyTask(null);
      setMonthlyReportNotes('');
    } catch (error) {
      console.error("Error completing monthly schedule:", error);
      toast.error("Erreur de mise à jour.");
    } finally {
      setIsSubmittingMonthly(false);
    }
  };

  const executeDeleteMonthlyTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'maintenance_schedules', taskId));
      toast.success("Tâche mensuelle supprimée.");
    } catch (error) {
      console.error("Error deleting monthly schedule:", error);
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleDeleteMonthlyTask = async (taskId: string) => {
    setMonthlyTaskToDelete(taskId);
  };

  // ================= CHECKLISTS JOURNALIÈRES HANDLERS =================
  const handleSaveDailyChecklist = async () => {
    setIsSavingDaily(true);
    try {
      const primaryGe = generators[0] || {
        fuelLevelPercent: 80,
        fuelLevelLiters: 350,
        engineHours: 1200,
        oilLevel: 'OK' as const,
        batteryStatus: 'OK' as const,
        generalStatus: 'OK' as const,
        notes: ''
      };

      const payload: Partial<DailyMaintenanceChecklist> = {
        date: selectedDailyDate,
        timestamp: serverTimestamp() as any,
        technicianId: user.id,
        technicianName: user.username,
        updatedAt: serverTimestamp() as any,
        geData: {
          fuelLevelPercent: Number(primaryGe.fuelLevelPercent) || 0,
          fuelLevelLiters: Number(primaryGe.fuelLevelLiters) || 0,
          engineHours: Number(primaryGe.engineHours) || 0,
          oilLevel: primaryGe.oilLevel || 'OK',
          batteryStatus: primaryGe.batteryStatus || 'OK',
          generalStatus: primaryGe.generalStatus || 'OK',
          notes: primaryGe.notes || ''
        },
        geDataList: generators,
        bacheData: {
          waterClarity: bacheWaterClarity,
          waterLevelPercent: Number(bacheLevelPercent) || 0,
          pumpStatus: bachePumpStatus,
          pressureBar: Number(bachePressure) || 0,
          notes: bacheNotes
        }
      };

      const existingRecord = dailyHistory.find(d => d.date === selectedDailyDate);
      if (existingRecord) {
        await updateDoc(doc(db, 'maintenance_daily_checklists', existingRecord.id), payload);
      } else {
        await addDoc(collection(db, 'maintenance_daily_checklists'), payload);
      }

      logEvent(user, 'Checklist Journalière', `Enregistrement du relevé du ${selectedDailyDate} (GE, Bâche)`);
      toast.success(`Checklist journalière enregistrée pour le ${selectedDailyDate} !`);
    } catch (error) {
      console.error("Error saving daily checklist:", error);
      toast.error("Erreur d'enregistrement de la checklist.");
    } finally {
      setIsSavingDaily(false);
    }
  };

  const filteredTasks = tasks.filter(t => filter === 'All' ? true : t.status === filter);

  const filteredMonthlyTasks = monthlyTasks.filter(t => {
    const matchMonth = t.targetMonth === selectedMonth;
    const matchEquip = equipmentFilter === 'Tous' ? true : t.equipmentType === equipmentFilter;
    return matchMonth && matchEquip;
  });

  return (
    <div className="space-y-6 text-[#2B2321]">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-secondary/35 shadow-sm hover:shadow-xl transition-shadow flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Module Maintenance</h2>
            <p className="text-xs text-[#2B2321]/60 mt-1">
              Génie technique, interventions, planning mensuel et checklists
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPdfPeriodType('day');
              setPdfPeriodValue(format(new Date(), 'yyyy-MM-dd'));
              setIsExportingPDF(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all"
            title="Exporter le rapport technique en PDF"
          >
            <Download className="w-4 h-4" />
            Exporter PDF
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#F2ECE4]/60 rounded-2xl border border-secondary/20">
          <button
            type="button"
            onClick={() => setActiveModuleTab('tickets')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeModuleTab === 'tickets'
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-primary/70 hover:bg-white/80"
            )}
          >
            <Wrench className="w-4 h-4" />
            Interventions & Incidents
          </button>

          <button
            type="button"
            onClick={() => setActiveModuleTab('planning')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeModuleTab === 'planning'
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-primary/70 hover:bg-white/80"
            )}
          >
            <Calendar className="w-4 h-4" />
            Planning Mensuel
          </button>

          <button
            type="button"
            onClick={() => setActiveModuleTab('checklists')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeModuleTab === 'checklists'
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-primary/70 hover:bg-white/80"
            )}
          >
            <CheckSquare className="w-4 h-4" />
            Checklists Journalières
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODULE TAB 1: INTERVENTIONS & INCIDENTS (TICKETS)                         */}
      {/* ========================================================================= */}
      {activeModuleTab === 'tickets' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1.5 bg-[#F2ECE4]/45 p-1 rounded-2xl border border-secondary/15 max-w-4xl">
              {(['All', 'NeedSubmitted', 'Pending', 'Accepted', 'Validated', 'Rejected'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer",
                    filter === t 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-primary/60 hover:text-primary hover:bg-white/45"
                  )}
                >
                  {t === 'All' ? 'Tous' : 
                   t === 'NeedSubmitted' ? 'Besoins Soumis' : 
                   t === 'Pending' ? 'Attentes Matériel' : 
                   t === 'Accepted' ? 'En Cours' : 
                   t === 'Validated' ? 'Terminés' : 'Rejetés'}
                </button>
              ))}
            </div>

            {canReport && (
              <button 
                onClick={() => setIsAddingTask(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-primary/95 transition-all shadow-md shadow-primary/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Signaler un Travail
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white rounded-3xl border border-secondary/20 p-12 text-center text-[#2B2321]/50 font-bold uppercase tracking-wider text-xs">
              Aucun travail enregistré dans cette catégorie.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map((task) => (
                <div 
                  key={task.id} 
                  className="bg-white rounded-3xl border border-secondary/25 hover:shadow-xl transition-all overflow-hidden flex flex-col group relative"
                >
                  {/* Status Header Badge */}
                  <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-white/95 backdrop-blur-md rounded-full shadow-sm border text-[10px] font-bold uppercase tracking-wider">
                    <span className={cn(
                      task.status === 'Validated' ? "text-emerald-600" :
                      task.status === 'Rejected' ? "text-red-500" : 
                      task.status === 'NeedSubmitted' ? "text-purple-600 font-extrabold animate-pulse" :
                      task.status === 'Pending' ? "text-amber-600" : "text-blue-600"
                    )}>
                      {task.status === 'Validated' ? 'Terminé' :
                       task.status === 'Rejected' ? 'Rejeté' : 
                       task.status === 'NeedSubmitted' ? 'Remplacement Soumis' :
                       task.status === 'Pending' ? 'Attente Pièce' : 'En Cours'}
                    </span>
                  </div>

                  <div className="p-6 space-y-4 flex-1">
                    <div className="pr-16">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Emplacement</span>
                      <h3 className="text-lg font-black text-[#2B2321]">{task.location}</h3>
                    </div>

                    <p className="text-xs text-[#2B2321]/80 line-clamp-3 bg-[#FDFBF7] p-3 rounded-2xl border border-secondary/15 font-medium">
                      {task.note}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] font-bold text-primary/70 pt-2 border-t border-secondary/10">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>{task.reporterName}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{task.timestamp ? format(parseDate(task.timestamp), 'dd/MM/yyyy HH:mm') : 'Récemment'}</span>
                      </div>
                    </div>

                    {task.cost && task.cost > 0 && (
                      <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-black flex justify-between items-center">
                        <span>Frais Pièce / Matériel :</span>
                        <span>{task.cost.toLocaleString()} FCFA</span>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="p-4 bg-secondary/5 border-t border-secondary/15 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setViewingTask(task)}
                      className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" /> Détails & Suivi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE TAB 2: PLANNING MENSUEL (SPLITS, BÂCHE, GE)                       */}
      {/* ========================================================================= */}
      {activeModuleTab === 'planning' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-3xl border border-secondary/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Month Selector */}
              <div className="flex items-center gap-2 bg-[#FDFBF7] p-2 rounded-2xl border border-secondary/25">
                <Calendar className="w-4 h-4 text-primary shrink-0 ml-1" />
                <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Mois Visé :</label>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-white px-3 py-1 border border-secondary/20 rounded-xl font-bold text-xs outline-none focus:border-primary text-[#2B2321]"
                />
              </div>

              {/* Equipment Filter */}
              <div className="flex flex-wrap gap-1 p-1 bg-secondary/10 rounded-2xl border border-secondary/20">
                {[
                  { id: 'Tous', label: 'Tous les Équipements' },
                  { id: 'Split', label: 'Splits' },
                  { id: 'Bache_Eau', label: 'Bâche à Eau' },
                  { id: 'Groupe_Electrogene', label: 'Groupe (GE)' },
                  { id: 'Autre', label: 'Autres' },
                ].map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => setEquipmentFilter(eq.id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      equipmentFilter === eq.id
                        ? "bg-primary text-white shadow-sm"
                        : "text-[#2B2321]/70 hover:bg-white/60"
                    )}
                  >
                    {eq.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateStandardMonthlyPlanning}
                disabled={isSubmittingMonthly}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                title="Créer automatiquement l'entretien mensuel standard pour les Splits, la Bâche à eau et le GE"
              >
                <RefreshCw className="w-4 h-4" />
                Générer Planning Standard ({selectedMonth})
              </button>

              {isMaintenanceOperator && (
                <button
                  type="button"
                  onClick={() => setIsAddingMonthlyTask(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-primary/95 shadow-md shadow-primary/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  + Planifier
                </button>
              )}
            </div>
          </div>

          {/* Monthly Tasks Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-secondary/25 shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Total Programmé</span>
              <p className="text-2xl font-black text-[#2B2321] mt-0.5">{filteredMonthlyTasks.length}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Réalisés</span>
              <p className="text-2xl font-black text-emerald-800 mt-0.5">
                {filteredMonthlyTasks.filter(t => t.status === 'Completed').length}
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">À Faire</span>
              <p className="text-2xl font-black text-amber-800 mt-0.5">
                {filteredMonthlyTasks.filter(t => t.status === 'Scheduled').length}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-700">Taux de Réalisation</span>
              <p className="text-2xl font-black text-blue-800 mt-0.5">
                {filteredMonthlyTasks.length > 0 
                  ? Math.round((filteredMonthlyTasks.filter(t => t.status === 'Completed').length / filteredMonthlyTasks.length) * 100) 
                  : 0}%
              </p>
            </div>
          </div>

          {/* Monthly Tasks List */}
          {loadingMonthly ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredMonthlyTasks.length === 0 ? (
            <div className="bg-white rounded-3xl border border-secondary/20 p-12 text-center text-[#2B2321]/60 space-y-3">
              <Calendar className="w-10 h-10 text-primary/40 mx-auto" />
              <p className="font-bold text-sm">Aucune maintenance mensuelle programmée pour {selectedMonth}.</p>
              <button
                type="button"
                onClick={handleGenerateStandardMonthlyPlanning}
                className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:bg-primary/90 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Générer le Planning Standard (Splits, Bâche, GE)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMonthlyTasks.map((t) => (
                <div 
                  key={t.id}
                  className="bg-white rounded-3xl border border-secondary/25 shadow-xs hover:shadow-xl transition-all p-6 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        {t.equipmentType === 'Split' && <div className="p-2 bg-sky-50 text-sky-600 rounded-xl"><Wrench className="w-5 h-5" /></div>}
                        {t.equipmentType === 'Bache_Eau' && <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Droplets className="w-5 h-5" /></div>}
                        {t.equipmentType === 'Groupe_Electrogene' && <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Zap className="w-5 h-5" /></div>}
                        {t.equipmentType === 'Autre' && <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Compass className="w-5 h-5" /></div>}
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">
                            {t.equipmentType === 'Split' ? 'Climatiseur / Split' :
                             t.equipmentType === 'Bache_Eau' ? 'Bâche à Eau' :
                             t.equipmentType === 'Groupe_Electrogene' ? 'Groupe Électrogène' : 'Autre Équipement'}
                          </span>
                          <h4 className="font-black text-[#2B2321] text-base leading-snug">{t.title}</h4>
                        </div>
                      </div>

                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border",
                        t.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        t.status === 'In_Progress' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {t.status === 'Completed' ? 'Réalisé' : t.status === 'In_Progress' ? 'En Cours' : 'À Faire'}
                      </span>
                    </div>

                    <div className="p-3 bg-[#FDFBF7] rounded-2xl border border-secondary/15 space-y-1.5 text-xs">
                      <p className="font-bold text-primary flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /> {t.location}
                      </p>
                      {t.description && (
                        <p className="text-[11px] text-[#2B2321]/75 leading-relaxed">{t.description}</p>
                      )}
                      <div className="pt-1.5 border-t border-secondary/10 flex justify-between text-[10px] font-bold text-primary/60">
                        <span>Date prévue: {t.scheduledDate}</span>
                        <span>Mois: {t.targetMonth}</span>
                      </div>
                    </div>

                    {t.status === 'Completed' && (
                      <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 text-xs space-y-1">
                        <p className="font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Réalisé par {t.completedBy || 'Technicien'}
                        </p>
                        {t.reportNotes && (
                          <p className="text-[11px] text-emerald-900 italic">"{t.reportNotes}"</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-secondary/15 flex items-center justify-between gap-2">
                    {t.status !== 'Completed' ? (
                      <button
                        type="button"
                        onClick={() => setCompletingMonthlyTask(t)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-4 h-4" /> Marquer Réalisé
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Maintenance Validée
                      </span>
                    )}

                    {canValidate && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMonthlyTask(t.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE TAB 3: CHECKLISTS JOURNALIÈRES (GE, BÂCHE)                         */}
      {/* ========================================================================= */}
      {activeModuleTab === 'checklists' && (
        <div className="space-y-6">
          {/* Top Bar for Date and Section Tabs */}
          <div className="bg-white p-5 rounded-3xl border border-secondary/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 bg-[#FDFBF7] p-2 rounded-2xl border border-secondary/25">
              <Calendar className="w-4 h-4 text-primary shrink-0 ml-1" />
              <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Date du Relevé :</label>
              <input 
                type="date" 
                value={selectedDailyDate}
                onChange={e => setSelectedDailyDate(e.target.value)}
                className="bg-white px-3 py-1 border border-secondary/20 rounded-xl font-bold text-xs outline-none focus:border-primary text-[#2B2321]"
              />
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-secondary/10 rounded-2xl border border-secondary/20">
              {[
                { id: 'all', label: 'Toutes les Checklists', icon: CheckSquare },
                { id: 'ge', label: 'Groupe (GE)', icon: Zap },
                { id: 'bache', label: 'Bâche à Eau', icon: Droplets },
              ].map((tab) => {
                const IconComp = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveChecklistSection(tab.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      activeChecklistSection === tab.id
                        ? "bg-primary text-white shadow-md"
                        : "text-[#2B2321]/70 hover:bg-white/60"
                    )}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSaveDailyChecklist}
              disabled={isSavingDaily}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-primary/95 shadow-md shadow-primary/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isSavingDaily ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Enregistrer Relevé ({selectedDailyDate})
            </button>
          </div>

          {/* Interactive Daily Checklist Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. CHECKLIST GROUPE ÉLECTROGÈNE (GE) */}
            {(activeChecklistSection === 'all' || activeChecklistSection === 'ge') && (() => {
              const currentGe = generators[activeGeIndex] || generators[0] || {
                fuelLevelPercent: 80,
                fuelLevelLiters: 400,
                engineHours: 0,
                oilLevel: 'OK',
                batteryStatus: 'OK',
                generalStatus: 'OK',
                notes: ''
              };

              return (
                <div className="bg-white rounded-3xl border border-secondary/30 p-6 shadow-xs space-y-5">
                  {/* Header & Multi-GE Tabs */}
                  <div className="space-y-3 border-b border-secondary/15 pb-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                          <Zap className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-black text-lg text-[#2B2321]">Groupes Électrogènes ({generators.length})</h3>
                          <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider">
                            {generators.length > 1 ? 'Gestion multi-groupes & Relevés' : 'Relevé quotidien de fonctionnement'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewGeModalOpen(true)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all"
                        title="Ajouter un autre Groupe Électrogène à la maintenance"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Générateur
                      </button>
                    </div>

                    {/* Generator Tabs Selector */}
                    <div className="flex flex-wrap gap-1.5 p-1 bg-[#FDFBF7] rounded-2xl border border-secondary/20">
                      {generators.map((ge, idx) => (
                        <button
                          key={ge.id || idx}
                          type="button"
                          onClick={() => setActiveGeIndex(idx)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                            activeGeIndex === idx
                              ? "bg-amber-600 text-white shadow-sm font-black"
                              : "text-primary/70 hover:bg-amber-50 font-bold"
                          )}
                        >
                          <span>{ge.name || `GE #${idx + 1}`}</span>
                          <span className={cn(
                            "px-1.5 py-0.2 text-[8px] rounded-full font-black",
                            activeGeIndex === idx ? "bg-white/25 text-white" : "bg-secondary/20 text-primary"
                          )}>
                            {ge.fuelLevelPercent}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form for Active Generator */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60">
                      <div className="flex items-center gap-2 flex-1">
                        <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                        <input
                          type="text"
                          value={currentGe.name || ''}
                          onChange={e => updateGeneratorField(activeGeIndex, 'name', e.target.value)}
                          placeholder="Nom du groupe (ex: GE Principal 250 kVA)"
                          className="font-black text-sm text-[#2B2321] bg-transparent outline-none w-full border-b border-dashed border-amber-400 focus:border-amber-600"
                        />
                      </div>
                      {generators.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGenerator(activeGeIndex)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Supprimer ce groupe"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Niveau Gasoil Slider & Volume */}
                    <div className="space-y-2 p-3.5 bg-[#FDFBF7] rounded-2xl border border-secondary/20">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-primary/70 uppercase tracking-wider text-[10px]">Niveau de Gasoil ({currentGe.name || 'Réservoir'})</span>
                        <span className="text-primary font-black text-sm">{currentGe.fuelLevelPercent || 0}% ({currentGe.fuelLevelLiters || 0} Litres)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="5"
                        value={currentGe.fuelLevelPercent || 0}
                        onChange={e => updateGeneratorField(activeGeIndex, 'fuelLevelPercent', Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-bold text-primary/50">
                        <span>0% (Réserve)</span>
                        <span>50% (Moitié)</span>
                        <span>100% (Plein)</span>
                      </div>
                    </div>

                    {/* Compteur Horaire */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Compteur Horaire Moteur (Heures)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={currentGe.engineHours || ''}
                        onChange={e => updateGeneratorField(activeGeIndex, 'engineHours', Number(e.target.value))}
                        className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-sm outline-none focus:border-primary text-[#2B2321]"
                        placeholder="Ex: 1245.5"
                      />
                    </div>

                    {/* Niveau Huile & Batterie */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Niveau d'Huile</label>
                        <select
                          value={currentGe.oilLevel || 'OK'}
                          onChange={e => updateGeneratorField(activeGeIndex, 'oilLevel', e.target.value)}
                          className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-xs outline-none focus:border-primary text-[#2B2321]"
                        >
                          <option value="OK">Correct (OK)</option>
                          <option value="Low">À compléter (Bas)</option>
                          <option value="Critical">Critique (Manque)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Batterie</label>
                        <select
                          value={currentGe.batteryStatus || 'OK'}
                          onChange={e => updateGeneratorField(activeGeIndex, 'batteryStatus', e.target.value)}
                          className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-xs outline-none focus:border-primary text-[#2B2321]"
                        >
                          <option value="OK">Excellente (OK)</option>
                          <option value="Weak">Charge Faible</option>
                          <option value="Bad">À remplacer</option>
                        </select>
                      </div>
                    </div>

                    {/* Notes GE */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Observations / Anomalies {currentGe.name}</label>
                      <textarea 
                        value={currentGe.notes || ''}
                        onChange={e => updateGeneratorField(activeGeIndex, 'notes', e.target.value)}
                        placeholder="Ex: Démarré pendant coupure SNE (2h). R.A.S..."
                        className="w-full p-3 border border-secondary/25 rounded-2xl text-xs font-medium outline-none focus:border-primary h-20 resize-none text-[#2B2321]"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2. CHECKLIST BÂCHE À EAU */}
            {(activeChecklistSection === 'all' || activeChecklistSection === 'bache') && (
              <div className="bg-white rounded-3xl border border-secondary/30 p-6 shadow-xs space-y-5">
                <div className="flex justify-between items-center border-b border-secondary/15 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <Droplets className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-[#2B2321]">Bâche à Eau</h3>
                      <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider">Qualité d'eau & Surpresseurs</p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
                    bacheWaterClarity === 'Limpide' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {bacheWaterClarity}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Niveau d'Eau % Slider */}
                  <div className="space-y-2 p-3.5 bg-[#FDFBF7] rounded-2xl border border-secondary/20">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-primary/70 uppercase tracking-wider text-[10px]">Niveau d'Eau Bâche</span>
                      <span className="text-primary font-black text-sm">{bacheLevelPercent}% Plein</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5"
                      value={bacheLevelPercent}
                      onChange={e => setBacheLevelPercent(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Qualité de l'Eau */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Aspect & Qualité Eau</label>
                    <select
                      value={bacheWaterClarity}
                      onChange={e => setBacheWaterClarity(e.target.value as any)}
                      className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-xs outline-none focus:border-primary text-[#2B2321]"
                    >
                      <option value="Limpide">Limpide & Parfaite</option>
                      <option value="Légèrement trouble">Légèrement trouble</option>
                      <option value="Trouble">Trouble / Traitement Requis</option>
                    </select>
                  </div>

                  {/* Surpresseur Status & Pressure */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Pompes / Surpresseurs</label>
                      <select
                        value={bachePumpStatus}
                        onChange={e => setBachePumpStatus(e.target.value as any)}
                        className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-xs outline-none focus:border-primary text-[#2B2321]"
                      >
                        <option value="Normal">Normal (OK)</option>
                        <option value="Avertissement">Bruit / Vibration</option>
                        <option value="Panne">En Panne</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Pression (Bar)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={bachePressure}
                        onChange={e => setBachePressure(Number(e.target.value))}
                        className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-sm outline-none focus:border-primary text-[#2B2321]"
                      />
                    </div>
                  </div>

                  {/* Notes Bâche */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Observations Bâche à Eau</label>
                    <textarea 
                      value={bacheNotes}
                      onChange={e => setBacheNotes(e.target.value)}
                      placeholder="Ex: Traitement chloration effectué..."
                      className="w-full p-3 border border-secondary/25 rounded-2xl text-xs font-medium outline-none focus:border-primary h-20 resize-none text-[#2B2321]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Daily Checklists History Table / Cards */}
          <div className="bg-white rounded-3xl border border-secondary/30 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#2B2321] flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Historique Récent des Relevés Journaliers
            </h3>

            {loadingDaily ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : dailyHistory.length === 0 ? (
              <p className="text-xs font-bold text-primary/50 text-center py-6">Aucun relevé journalier historique enregistré.</p>
            ) : (
              <div className="divide-y divide-secondary/15 text-xs">
                {dailyHistory.map((rec) => (
                  <div 
                    key={rec.id}
                    onClick={() => setSelectedDailyDate(rec.date)}
                    className={cn(
                      "py-3 px-3 rounded-2xl hover:bg-[#FDFBF7] cursor-pointer transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3",
                      selectedDailyDate === rec.date && "bg-secondary/10 border border-secondary/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 text-primary rounded-xl font-mono font-black text-xs">
                        {rec.date}
                      </div>
                      <div>
                        <p className="font-black text-[#2B2321]">{rec.technicianName || 'Maintenancier'}</p>
                        <p className="text-[10px] text-primary/60 font-bold">Technicien enregistreur</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {rec.geData && (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg text-[10px] font-bold border border-amber-200">
                          ⚡ GE: {rec.geData.fuelLevelPercent}% Gasoil ({rec.geData.engineHours}h)
                        </span>
                      )}
                      {rec.bacheData && (
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg text-[10px] font-bold border border-blue-200">
                          🚰 Bâche: {rec.bacheData.waterClarity} ({rec.bacheData.waterLevelPercent}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      <AnimatePresence>
        {/* MODAL 1: ADD TICKET / INTERVENTION */}
        {isAddingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white border border-secondary/30 shadow-2xl rounded-3xl p-8 my-8 text-[#2B2321]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase">Signaler des Travaux / Remplacement</h3>
                <button onClick={() => setIsAddingTask(false)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Type d'emplacement</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-secondary/10 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setSelectedLocationType('room')}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all",
                        selectedLocationType === 'room' ? "bg-white text-primary shadow-sm" : "text-[#2B2321]/60"
                      )}
                    >
                      Chambre
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLocationType('hall')}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all",
                        selectedLocationType === 'hall' ? "bg-white text-primary shadow-sm" : "text-[#2B2321]/60"
                      )}
                    >
                      Salle
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLocationType('other')}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold transition-all",
                        selectedLocationType === 'other' ? "bg-white text-primary shadow-sm" : "text-[#2B2321]/60"
                      )}
                    >
                      Autre
                    </button>
                  </div>
                </div>

                {selectedLocationType === 'room' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Sélectionner la Chambre</label>
                    <select
                      value={selectedRoomId}
                      onChange={e => setSelectedRoomId(e.target.value)}
                      className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold text-sm focus:border-primary text-[#2B2321]"
                      required
                    >
                      <option value="">-- Choisir une chambre --</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>Chambre {r.number} ({r.type})</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedLocationType === 'hall' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Sélectionner la Salle</label>
                    <select
                      value={selectedHallId}
                      onChange={e => setSelectedHallId(e.target.value)}
                      className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold text-sm focus:border-primary text-[#2B2321]"
                      required
                    >
                      <option value="">-- Choisir une salle --</option>
                      {halls.map(h => (
                        <option key={h.id} value={h.id}>{h.name} ({h.type})</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedLocationType === 'other' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Lieu exact</label>
                    <input
                      type="text"
                      placeholder="Ex: Cuisine, Réception, Terrasse, etc."
                      value={customLocation}
                      onChange={e => setCustomLocation(e.target.value)}
                      className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold text-sm focus:border-primary text-[#2B2321]"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPartReplacement"
                    checked={isPartReplacement}
                    onChange={(e) => setIsPartReplacement(e.target.checked)}
                    className="w-5 h-5 accent-primary cursor-pointer"
                  />
                  <label htmlFor="isPartReplacement" className="text-sm font-bold text-[#2B2321]">
                    Est-ce un remplacement de pièce ?
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Description des Travaux / Pièces</label>
                  <textarea
                    placeholder="Précisez la nature des réparations ou du matériel requis..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-medium text-xs focus:border-primary h-24 resize-none text-[#2B2321]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Montant estimé Dépense / Matériel (FCFA - Optionnel)</label>
                  <input
                    type="number"
                    placeholder="Ex: 25000"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold text-sm focus:border-primary text-[#2B2321]"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="flex-1 py-4 bg-secondary/10 hover:bg-secondary/20 text-primary rounded-2xl font-bold uppercase tracking-widest text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-primary text-white hover:bg-primary/90 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Soumettre
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL 2: ADD MONTHLY SCHEDULE */}
        {isAddingMonthlyTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white border border-secondary/30 shadow-2xl rounded-3xl p-8 my-8 text-[#2B2321]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black tracking-tight uppercase">Programmer une Maintenance Mensuelle</h3>
                <button onClick={() => setIsAddingMonthlyTask(false)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddMonthlyTask} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-primary/70 uppercase text-[10px]">Type d'équipement</label>
                  <select
                    value={monthlyEquipmentType}
                    onChange={e => setMonthlyEquipmentType(e.target.value as any)}
                    className="w-full p-3 border border-secondary/30 rounded-2xl font-bold outline-none focus:border-primary text-[#2B2321]"
                  >
                    <option value="Split">Climatiseur / Split</option>
                    <option value="Bache_Eau">Bâche à Eau</option>
                    <option value="Groupe_Electrogene">Groupe Électrogène (GE)</option>
                    <option value="Autre">Autre Équipement</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-primary/70 uppercase text-[10px]">Titre de la maintenance</label>
                  <input
                    type="text"
                    placeholder="Ex: Nettoyage Filtres Splits Étage 2"
                    value={monthlyTitle}
                    onChange={e => setMonthlyTitle(e.target.value)}
                    className="w-full p-3 border border-secondary/30 rounded-2xl font-bold outline-none focus:border-primary text-[#2B2321]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-primary/70 uppercase text-[10px]">Emplacement / Équipement exact</label>
                  <input
                    type="text"
                    placeholder="Ex: Chambres 201 à 210, Bâche principale, etc."
                    value={monthlyLocation}
                    onChange={e => setMonthlyLocation(e.target.value)}
                    className="w-full p-3 border border-secondary/30 rounded-2xl font-bold outline-none focus:border-primary text-[#2B2321]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-primary/70 uppercase text-[10px]">Mois Cible</label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="w-full p-3 border border-secondary/30 rounded-2xl font-bold outline-none focus:border-primary text-[#2B2321]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-primary/70 uppercase text-[10px]">Date prévue</label>
                    <input
                      type="date"
                      value={monthlyScheduledDate}
                      onChange={e => setMonthlyScheduledDate(e.target.value)}
                      className="w-full p-3 border border-secondary/30 rounded-2xl font-bold outline-none focus:border-primary text-[#2B2321]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-primary/70 uppercase text-[10px]">Instructions / Détails</label>
                  <textarea
                    placeholder="Consignes particulières..."
                    value={monthlyDescription}
                    onChange={e => setMonthlyDescription(e.target.value)}
                    className="w-full p-3 border border-secondary/30 rounded-2xl font-medium outline-none focus:border-primary h-20 resize-none text-[#2B2321]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingMonthlyTask(false)}
                    className="flex-1 py-3 bg-secondary/10 hover:bg-secondary/20 text-primary rounded-2xl font-bold uppercase tracking-wider text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingMonthly}
                    className="flex-1 py-3 bg-primary text-white hover:bg-primary/95 rounded-2xl font-bold uppercase tracking-wider text-xs shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {isSubmittingMonthly ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL 3: COMPLETE MONTHLY TASK */}
        {completingMonthlyTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-3xl p-6 my-8 text-[#2B2321]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black tracking-tight uppercase text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Validation Maintenance Mensuelle
                </h3>
                <button onClick={() => setCompletingMonthlyTask(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <p className="font-black text-emerald-900">{completingMonthlyTask.title}</p>
                  <p className="text-[11px] text-emerald-700">{completingMonthlyTask.location}</p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-primary/70 uppercase text-[10px]">Rapport / Observations du technicien</label>
                  <textarea
                    placeholder="Indiquez les travaux effectués, produits appliqués, filtres changés..."
                    value={monthlyReportNotes}
                    onChange={e => setMonthlyReportNotes(e.target.value)}
                    className="w-full p-3 border border-secondary/30 rounded-2xl font-medium outline-none focus:border-primary h-24 resize-none text-[#2B2321]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCompletingMonthlyTask(null)}
                    className="flex-1 py-3 bg-secondary/10 hover:bg-secondary/20 text-primary rounded-2xl font-bold uppercase tracking-wider text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteMonthlyTask}
                    disabled={isSubmittingMonthly}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold uppercase tracking-wider text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                  >
                    {isSubmittingMonthly ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Clôturer Tâche
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL 4: VIEW / VALIDATE TICKET DETAILS */}
        {viewingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white border border-secondary/30 shadow-2xl rounded-3xl p-6 sm:p-8 my-8 text-[#2B2321]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight uppercase">Détails de l'Intervention</h3>
                <button onClick={() => setViewingTask(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Lieu</span>
                  <p className="text-base font-black text-[#2B2321]">{viewingTask.location}</p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Description</span>
                  <p className="p-3 bg-[#FDFBF7] rounded-2xl border border-secondary/15 font-medium">{viewingTask.note}</p>
                </div>

                {/* Validation Actions for Managers / Admins */}
                {canValidate && viewingTask.status === 'NeedSubmitted' && (
                  <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                    <p className="font-bold text-purple-900 text-xs">Demande de Remplacement en attente de validation :</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleValidateReplacement(viewingTask, true)}
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4" /> Approuver Remplacement
                      </button>
                      <button
                        type="button"
                        onClick={() => handleValidateReplacement(viewingTask, false)}
                        disabled={isSubmitting}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" /> Rejeter
                      </button>
                    </div>
                  </div>
                )}

                {/* Operator Take Charge */}
                {isMaintenanceOperator && viewingTask.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => handleAcceptTask(viewingTask)}
                    disabled={isSubmitting}
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Wrench className="w-4 h-4" /> Prendre en Charge la Réparation
                  </button>
                )}

                {/* Final Completion Closure */}
                {isMaintenanceOperator && viewingTask.status === 'Accepted' && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                    <p className="font-bold text-emerald-900">Finaliser et Clôturer les Travaux :</p>
                    {viewingTask.isPartReplacement && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-emerald-900">Photo Avant</label>
                          <button
                            type="button"
                            onClick={() => completionFileBeforeRef.current?.click()}
                            className="w-full h-24 border-2 border-dashed border-emerald-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-emerald-100 transition-colors"
                          >
                            {completionPhotoBefore ? (
                              <img src={completionPhotoBefore} alt="Before" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <><Camera className="w-6 h-6 text-emerald-600" /><span className="text-[9px] font-bold uppercase text-emerald-700">Ajouter</span></>
                            )}
                          </button>
                          <input type="file" ref={completionFileBeforeRef} onChange={e => handleCompletionPhotoUpload(e, 'before')} accept="image/*" className="hidden" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-emerald-900">Photo Après</label>
                          <button
                            type="button"
                            onClick={() => completionFileAfterRef.current?.click()}
                            className="w-full h-24 border-2 border-dashed border-emerald-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-emerald-100 transition-colors"
                          >
                            {completionPhotoAfter ? (
                              <img src={completionPhotoAfter} alt="After" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <><Camera className="w-6 h-6 text-emerald-600" /><span className="text-[9px] font-bold uppercase text-emerald-700">Ajouter</span></>
                            )}
                          </button>
                          <input type="file" ref={completionFileAfterRef} onChange={e => handleCompletionPhotoUpload(e, 'after')} accept="image/*" className="hidden" />
                        </div>
                      </div>
                    )}
                    <input 
                      type="text"
                      placeholder="Commentaire de résolution..."
                      value={completionComment}
                      onChange={e => setCompletionComment(e.target.value)}
                      className="w-full p-3 bg-white border border-emerald-300 rounded-xl outline-none font-medium text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleCompleteTask(viewingTask)}
                      disabled={isSubmittingCompletion}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmittingCompletion ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Clôturer l'Intervention
                    </button>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setViewingTask(null)}
                    className="w-full py-3 bg-secondary/10 hover:bg-secondary/20 text-[#2B2321] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PDF Export Modal */}
      <AnimatePresence>
        {isExportingPDF && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-secondary/30 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#2B2321]">Exporter Rapport Maintenance</h3>
                    <p className="text-xs text-[#2B2321]/60">Générer un PDF structuré du jour, semaine ou mois</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportingPDF(false)}
                  className="p-2 hover:bg-secondary/10 rounded-full text-[#2B2321]/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#2B2321]/70 uppercase tracking-wider mb-2">
                    Période du Rapport
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPdfPeriodType('day');
                        setPdfPeriodValue(format(new Date(), 'yyyy-MM-dd'));
                      }}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all",
                        pdfPeriodType === 'day'
                          ? "bg-primary text-white border-primary"
                          : "bg-secondary/10 text-[#2B2321] border-secondary/20 hover:bg-secondary/20"
                      )}
                    >
                      Jour
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfPeriodType('week');
                        setPdfPeriodValue(format(new Date(), 'yyyy-MM-dd'));
                      }}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all",
                        pdfPeriodType === 'week'
                          ? "bg-primary text-white border-primary"
                          : "bg-secondary/10 text-[#2B2321] border-secondary/20 hover:bg-secondary/20"
                      )}
                    >
                      Semaine
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfPeriodType('month');
                        setPdfPeriodValue(format(new Date(), 'yyyy-MM'));
                      }}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all",
                        pdfPeriodType === 'month'
                          ? "bg-primary text-white border-primary"
                          : "bg-secondary/10 text-[#2B2321] border-secondary/20 hover:bg-secondary/20"
                      )}
                    >
                      Mois
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2321]/70 uppercase tracking-wider mb-2">
                    {pdfPeriodType === 'month' ? 'Sélectionner le Mois (AAAA-MM)' : 'Sélectionner la Date (AAAA-MM-JJ)'}
                  </label>
                  <input
                    type={pdfPeriodType === 'month' ? 'month' : 'date'}
                    value={pdfPeriodValue}
                    onChange={(e) => setPdfPeriodValue(e.target.value)}
                    className="w-full p-3 bg-secondary/10 border border-secondary/20 rounded-2xl outline-none font-bold text-sm text-[#2B2321]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportingPDF(false)}
                  className="w-1/2 py-3 bg-secondary/10 hover:bg-secondary/20 text-[#2B2321] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-1/2 py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for adding new generator */}
      <AnimatePresence>
        {isAddingNewGeModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-secondary/30 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-center border-b border-secondary/15 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-base text-[#2B2321]">Ajouter un Groupe Électrogène</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingNewGeModalOpen(false)}
                  className="p-1.5 text-[#2B2321]/60 hover:text-[#2B2321] hover:bg-secondary/10 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Désignation du Groupe</label>
                  <input
                    type="text"
                    value={newGeName}
                    onChange={e => setNewGeName(e.target.value)}
                    placeholder="Ex: GE #3 - VIP / Terrasse (50 kVA)"
                    className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-sm outline-none focus:border-primary text-[#2B2321]"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Capacité du Réservoir (Litres)</label>
                  <input
                    type="number"
                    value={newGeCapacity}
                    onChange={e => setNewGeCapacity(e.target.value)}
                    placeholder="Ex: 300"
                    className="w-full p-3 border border-secondary/25 rounded-2xl font-bold text-sm outline-none focus:border-primary text-[#2B2321]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNewGeModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-[#2B2321]/70 hover:bg-secondary/10"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAddNewGenerator}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-600/20"
                >
                  Ajouter au Système
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!monthlyTaskToDelete}
        title="Supprimer la tâche mensuelle"
        message="Voulez-vous vraiment supprimer cette tâche mensuelle ?"
        confirmLabel="Supprimer"
        onConfirm={() => monthlyTaskToDelete && executeDeleteMonthlyTask(monthlyTaskToDelete)}
        onClose={() => setMonthlyTaskToDelete(null)}
      />
    </div>
  );
};
