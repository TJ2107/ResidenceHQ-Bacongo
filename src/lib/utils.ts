import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, setDoc, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

import { toast } from 'sonner';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.debug(`[Firestore Cache/Sync] ${operationType} sur ${path}: ${errorMessage}`);
  
  // Do not pop up intrusive toasts for background READ/LIST/GET listeners or initial sync passes
  if (operationType === OperationType.LIST || operationType === OperationType.GET) {
    return;
  }

  if (errorMessage.toLowerCase().includes('permission-denied') || errorMessage.toLowerCase().includes('insufficient permissions')) {
    // Only show warning if it's an active write/delete action by the user
    toast.error("Permissions insuffisantes pour cette opération.");
  } else if (!errorMessage.toLowerCase().includes('quota')) {
    // Show error for other non-quota issues on explicit actions
    toast.error(`Erreur: ${errorMessage}`);
  }
}

import { LOW_STOCK_THRESHOLD } from '../constants';
import { Product, UserProfile } from '../types';

export const logEvent = async (user: UserProfile, action: string, details: string) => {
  if (!user?.id) return;
  try {
    const existingLogsStr = localStorage.getItem('residence_event_logs');
    const logs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
    logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('residence_event_logs', JSON.stringify(logs.slice(0, 200)));
  } catch (e) {}

  try {
    await addDoc(collection(db, 'event_logs'), {
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    // Ignore Firestore permission errors in local standalone mode
  }
};

export const updateUserPresence = async (user: UserProfile) => {
  if (!user?.id) return;
  try {
    const sessionRef = doc(db, 'sessions', user.id);
    await setDoc(sessionRef, {
      username: user.username,
      role: user.role,
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    // Ignore Firestore permission errors in local standalone mode
  }
};

export const getLowStockProducts = (products: Product[]) => products.filter(p => p.stock <= LOW_STOCK_THRESHOLD);

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const sendAppNotification = async (type: 'info' | 'alert' | 'order_ready', message: string, hotelName: string = 'Résidence HQ', logoUrl: string = '/logo.png', targetRole?: string) => {
  // 1. Browser Notification
  if (('Notification' in window) && Notification.permission === 'granted') {
    new Notification(`${type.toUpperCase()} - ${hotelName}`, {
      body: message,
      icon: logoUrl
    });
  }

  // 2. Firestore Notification
  try {
    await addDoc(collection(db, 'notifications'), {
      type,
      message,
      timestamp: serverTimestamp(),
      readBy: [],
      targetRole: targetRole || null
    });
  } catch (error) {
    console.error("Error creating app notification:", error);
  }
};

export const sendStockNotification = async (productName: string, currentStock: number, hotelName: string = 'Résidence HQ', logoUrl: string = '/logo.png', productId?: string) => {
  // 1. Browser Notification
  if (('Notification' in window) && Notification.permission === 'granted') {
    new Notification(`Alerte Stock Bas - ${hotelName}`, {
      body: `L'article "${productName}" est presque épuisé. Stock restant : ${currentStock}`,
      icon: logoUrl
    });
  }

  // 2. Firestore Alert (Persistent & Confirmable)
  try {
    // Check if an unread alert already exists for this product to avoid spam
    if (productId) {
      const q = query(
        collection(db, 'notifications'),
        where('productId', '==', productId),
        where('type', '==', 'low_stock'),
        limit(1)
      );
      const existing = await getDocs(q);
      // Only create if no existing alert or if the existing ones are all read (simplified: if none exists)
      if (!existing.empty) {
        const lastAlert = existing.docs[0].data();
        // If the last alert is very recent (e.g. within last hour), don't spam
        const hourAgo = Date.now() - 3600000;
        if (lastAlert.timestamp?.toMillis() > hourAgo) return;
      }
    }

    await addDoc(collection(db, 'notifications'), {
      type: 'low_stock',
      message: `L'article "${productName}" est presque épuisé. Stock restant : ${currentStock}`,
      timestamp: serverTimestamp(),
      readBy: [],
      productId,
      productName,
      stock: currentStock
    });
  } catch (error) {
    console.error("Error creating stock alert:", error);
  }
};

export const sendRestockNotification = async (productName: string, addedQuantity: number, newStock: number, hotelName: string = 'Résidence HQ', logoUrl: string = '/logo.png', productId?: string) => {
  // 1. Browser Notification
  if (('Notification' in window) && Notification.permission === 'granted') {
    new Notification(`Réapprovisionnement - ${hotelName}`, {
      body: `L'article "${productName}" a été réapprovisionné (+${addedQuantity}). Nouveau stock : ${newStock}`,
      icon: logoUrl
    });
  }

  // 2. Firestore Notification
  try {
    await addDoc(collection(db, 'notifications'), {
      type: 'restock',
      message: `L'article "${productName}" a été réapprovisionné. +${addedQuantity} unités ajoutées. Nouveau stock : ${newStock}`,
      timestamp: serverTimestamp(),
      readBy: [],
      productId,
      productName,
      addedQuantity,
      stock: newStock
    });
  } catch (error) {
    console.error("Error creating restock notification:", error);
  }
};

export const syncOct4Sales = async () => {
  // Purged: Dummy mock sales generator completely disabled
  return Promise.resolve();
};

export const migratePastSalesToNewLocationRules = async () => {
  // Purged: Mock sales migration completely disabled
  return Promise.resolve(0);
};

export const wipeAllSalesAndDatabase = async (): Promise<{ success: boolean; error?: string }> => {
  const collectionsToWipe = [
    'sales',
    'shisha_sales',
    'pool_tickets',
    'cash_closures',
    'expenses',
    'bookings',
    'reservations',
    'quotes_invoices',
    'event_logs',
    'notifications',
    'messages',
    'cleaning_tasks',
    'maintenance_tasks',
    'maintenance_schedules',
    'maintenance_daily_checklists',
    'warehouse_movements',
    'warehouse_products',
    'reviews',
    'guests',
    'shisha_products',
    'products',
    'rooms',
    'halls',
    'user_loyalty',
    'loyalty',
    'app_updates'
  ];

  try {
    for (const col of collectionsToWipe) {
      try {
        const snap = await getDocs(collection(db, col));
        if (snap.size > 0) {
          const docs = snap.docs;
          const chunkSize = 400;
          for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + chunkSize);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (colErr: any) {
        console.warn(`Purge skipped or empty for ${col}:`, colErr?.message);
      }
    }

    // Clear all client-side cached data in localStorage
    const keysToRemove = [
      'residence_sales',
      'residence_pool_tickets',
      'residence_bookings',
      'residence_reservations',
      'residence_expenses',
      'residence_maintenance_tasks',
      'residence_cleaning_tasks',
      'residence_notifications',
      'residence_products',
      'residence_rooms',
      'residence_halls',
      'residence_cached_users',
      'residence_quotes'
    ];

    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });

    try {
      localStorage.setItem('residence_sales', '[]');
      localStorage.setItem('residence_products', '[]');
      localStorage.setItem('residence_rooms', '[]');
      localStorage.setItem('residence_halls', '[]');
      localStorage.setItem('database_wiped_v1', 'true');
    } catch (_) {}

    return { success: true };
  } catch (error: any) {
    console.error("Erreur lors de la purge générale:", error);
    return { success: false, error: error?.message || 'Erreur inconnue' };
  }
};

export const cleanupOrphanExpenseNotifications = async () => {
  try {
    const [notifSnap, expSnap] = await Promise.all([
      getDocs(collection(db, 'notifications')),
      getDocs(collection(db, 'expenses'))
    ]);

    const expensesById = new Map<string, any>();
    const expensesByDesc = new Map<string, any>();
    expSnap.docs.forEach(d => {
      const data = d.data();
      expensesById.set(d.id, data);
      if (data.description) {
        expensesByDesc.set(data.description.toLowerCase().trim(), data);
      }
    });

    const toDelete: any[] = [];
    notifSnap.docs.forEach(d => {
      const data = d.data();
      const isExpense = data.type === 'expense' || 
        (data.message && data.message.toLowerCase().includes('en attente de validation') && 
         (data.message.toLowerCase().includes('dépense') || data.message.toLowerCase().includes('depense')));
      
      if (isExpense) {
        let matchedExp = data.expenseId ? expensesById.get(data.expenseId) : null;
        if (!matchedExp && data.expenseData?.description) {
          matchedExp = expensesByDesc.get(data.expenseData.description.toLowerCase().trim());
        }
        if (!matchedExp && data.message) {
          for (const [desc, exp] of expensesByDesc.entries()) {
            if (data.message.toLowerCase().includes(desc)) {
              matchedExp = exp;
              break;
            }
          }
        }

        // If the expense is already Approved, Rejected, or handled is true
        if (data.handled === true || (matchedExp && matchedExp.status !== 'Pending')) {
          toDelete.push(d.ref);
        }
      }
    });

    if (toDelete.length > 0) {
      const b = writeBatch(db);
      toDelete.forEach(ref => b.delete(ref));
      await b.commit();
      console.log(`[cleanupOrphanExpenseNotifications] Nettoyé ${toDelete.length} notifications orphelines de dépenses.`);
    }
  } catch (error) {
    console.debug("Notice cleaning orphan expense notifications:", error);
  }
};

export const parseDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (e) {
      console.error("Error calling toDate() on timestamp:", e);
    }
  }
  if (typeof value.toMillis === 'function') {
    try {
      return new Date(value.toMillis());
    } catch (e) {}
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000));
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

