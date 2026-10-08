import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'manager' | 'receptionist' | 'barman' | 'staff' | 'cook' | 'maintenance' | 'caissiere' | 'serveur' | 'valet_de_chambre' | 'client' | 'pending_registration';

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  email: string;
  isInvited?: boolean;
  password?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  stockTerrasse?: number;
  stockReception?: number;
  stockVip?: number;
}

export interface SaleItem {
  productName: string;
  productId: string;
  category: string;
  price: number;
  quantity: number;
  total?: number;
}

export type PaymentMethod = 'Cash' | 'Card' | 'Mobile Money' | 'Room Charge';

export type SaleLocation = 'Terrasse' | 'VIP' | 'Réception' | 'Restaurant' | 'Chicha';
export type KitchenStatus = 'Pending' | 'Preparing' | 'Ready' | 'Delivered' | 'Cancelled';

export interface Sale {
  id: string;
  items: SaleItem[];
  totalPrice: number;
  timestamp: Timestamp;
  sellerId: string;
  sellerName: string;
  sellerRole?: string;
  paymentMethod: PaymentMethod;
  roomId?: string; // If charged to a room
  location?: SaleLocation;
  tableNumber?: string;
  receptionOrientation?: 'Terrasse' | 'VIP' | 'Réception';
  kitchenStatus?: KitchenStatus;
  sourceId?: string;
  bookingId?: string;
  originalLocation?: string;
  alreadyCashedAtPOS?: boolean;
  cashedAt?: string;
  paymentStatus?: string;
}

export type RoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';
export type RoomType = 'Résidence 3 chambres' | 'Résidence 2 chambres' | 'Appartement 1 ch. + salon' | 'Chambre de Luxe' | 'Chambre Standard';

export type HallStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';
export type HallType = 'Salle de Fête' | 'Salle Hammam' | 'Salle de Massage' | 'Salle de Pied';

export interface Hall {
  id: string;
  name: string;
  type: HallType;
  price: number;
  status: HallStatus;
  currentGuestId?: string;
  currentGuestName?: string;
  checkInDate?: Timestamp;
  expectedCheckOutDate?: Timestamp;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  email?: string;
  preferences?: string;
  totalStays: number;
  lastStay?: Timestamp;
  loyaltyPoints?: number;
  createdAt?: Timestamp;
}

export interface Room {
  id: string;
  number: string;
  type: RoomType;
  price: number;
  status: RoomStatus;
  currentGuestId?: string;
  currentGuestName?: string;
  checkInDate?: Timestamp;
  expectedCheckOutDate?: Timestamp;
  advancePaid?: number;
  advancePaymentMethod?: string;
}

export interface Booking {
  id: string;
  roomId: string;
  roomNumber: string;
  guestId: string;
  guestName: string;
  checkInDate: Timestamp;
  checkOutDate: Timestamp;
  totalNights: number;
  roomCharge: number;
  posCharges: number;
  totalPaid: number;
  paymentMethod: PaymentMethod;
  advancePaid?: number;
  discount?: number;
  timestamp?: Timestamp;
  channel?: 'Direct' | 'OTA' | 'Agency' | 'Corporate';
  segment?: 'Leisure' | 'Business' | 'Group';
}

export interface Reservation {
  id: string;
  roomId: string;
  roomNumber: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  checkInDate: Timestamp;
  checkOutDate: Timestamp;
  status: 'Confirmed' | 'Cancelled' | 'CheckedIn';
  createdAt: Timestamp;
  channel?: 'Direct' | 'OTA' | 'Agency' | 'Corporate';
  segment?: 'Leisure' | 'Business' | 'Group';
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'Salaries' | 'Utilities' | 'Stock' | 'Maintenance' | 'Other';
  timestamp: Timestamp;
  recordedBy: string;
  recordedById?: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  validatedBy?: string;
  maintenanceTaskId?: string;
  location?: string;
}

export interface ClosureStockItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

export interface ClosureStockSummary {
  totalProductsCount: number;
  totalStockUnits: number;
  totalStockValue: number;
  lowStockCount: number;
}

export interface CashClosureReport {
  id?: string;
  cashierId: string;
  cashierName: string;
  cashierRole: string;
  location: string;
  timestamp: Timestamp;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  roomSales: number;
  totalSales: number;
  salesCount: number;
  physicalCashCounted: number;
  discrepancy: number;
  notes?: string;
  totalExpenses?: number;
  expensesCount?: number;
  expensesDetails?: any[];
  stockSummary?: ClosureStockSummary;
  stockDetails?: ClosureStockItem[];
  salesDetails?: any[];
}

export interface PoolTicket {
  id: string;
  ticketId: string;
  type: 'Adult' | 'Child' | 'Combined' | string;
  price: number;
  adultCount?: number;
  childCount?: number;
  quantity?: number;
  timestamp: Timestamp;
  sellerId: string;
  sellerName: string;
  sellerRole?: string;
  isValid: boolean;
  roomId?: string;
  roomNumber?: string;
  paymentMethod?: string;
}

export interface CleaningTask {
  id: string;
  roomId?: string;
  roomNumber?: string;
  hallId?: string;
  hallName?: string;
  cleanerId: string;
  cleanerName: string;
  photoUrl: string;
  timestamp: Timestamp;
  status: 'Pending' | 'Validated' | 'Rejected';
  notes?: string;
}

export interface AppNotification {
  id: string;
  type: 'low_stock' | 'info' | 'alert' | 'order_ready' | 'maintenance' | 'chauffeur' | 'admin_hq' | 'expense' | string;
  message: string;
  timestamp: Timestamp;
  readBy: string[]; // User IDs who have acknowledged the notification
  productId?: string;
  productName?: string;
  stock?: number;
  saleId?: string;
  location?: SaleLocation;
  targetUserId?: string;
  targetRole?: UserRole | string;
  maintenanceTaskId?: string;
  source?: 'chauffeur' | 'admin_hq' | 'hotel' | 'system' | string;
  rideId?: string;
  expenseId?: string;
  handled?: boolean;
  expenseData?: {
    description?: string;
    amount?: number;
    category?: Expense['category'];
    location?: string;
    recordedBy?: string;
    recordedById?: string;
  };
  title?: string;
  version?: string;
  changelog?: string;
  isMandatory?: boolean;
  level?: 'info' | 'alert' | 'success' | string;
}

export interface AppSettings {
  id: string;
  theme: 'default' | 'modern' | 'classic' | 'nature' | 'custom';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  hotelName: string;
  poolAdultPrice?: number;
  poolChildPrice?: number;
  address?: string;
  phone?: string;
  email?: string;
  nifRccm?: string;
  bankDetails?: string;
  invoiceFooterNote?: string;
  currentAppVersion?: string;
  appVersionTitle?: string;
  appVersionChangelog?: string;
  appVersionPublishedAt?: any;
}

export type DocumentType = 'Quote' | 'Invoice';
export type DocumentStatus = 'Brouillon' | 'Envoyé' | 'Validé' | 'Payé' | 'Annulé';

export interface QuoteInvoiceItem {
  id: string;
  description: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteInvoice {
  id: string;
  number: string; // ex: DEV-2026-001 ou FAC-2026-001
  type: DocumentType;
  status: DocumentStatus;
  
  // Ref Hôtel (Entête préconçue)
  hotelName: string;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  hotelNifRccm?: string;
  hotelLogoUrl?: string;

  // Client
  clientName: string;
  clientCompany?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  clientNifRccm?: string;

  // Dates
  date: string; // YYYY-MM-DD
  validUntilDate?: string;
  dueDate?: string;
  
  // Articles / Lignes
  items: QuoteInvoiceItem[];
  subtotal: number;
  taxRate?: number; // % TVA ex: 18%
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  advancePaid?: number; // Acompte payé
  
  paymentTerms?: string;
  notes?: string;
  bankDetails?: string;

  createdBy: string;
  createdById: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  convertedFromQuoteId?: string;
  convertedInvoiceId?: string;
}

export interface EventLog {
  id: string;
  userId: string;
  username: string;
  userRole: UserRole;
  action: string;
  details: string;
  timestamp: Timestamp;
}

export interface UserSession {
  id: string;
  username: string;
  role: UserRole;
  lastActive: Timestamp;
}

export interface Review {
  id: string;
  guestId: string;
  guestName: string;
  rating: number; // 1-5
  comment: string;
  timestamp: Timestamp;
  category: 'Room' | 'Service' | 'Food' | 'General';
}

export interface MaintenanceTask {
  id: string;
  location: string;
  note: string;
  photoBefore: string; // Base64 jpeg image
  photoAfter: string;  // Base64 jpeg image
  status: 'NeedSubmitted' | 'Pending' | 'Accepted' | 'Validated' | 'Rejected';
  reporterId: string;
  reporterName: string;
  timestamp: Timestamp;
  validatedBy?: string;
  validatedById?: string;
  validatedAt?: Timestamp;
  materialApprovedBy?: string;
  materialApprovedById?: string;
  materialApprovedAt?: Timestamp;
  acceptedBy?: string;
  acceptedById?: string;
  acceptedAt?: Timestamp;
  cost?: number;
  expenseId?: string;
  isPartReplacement?: boolean;
}

export interface MonthlyMaintenanceTask {
  id: string;
  equipmentType: 'Split' | 'Bache_Eau' | 'Groupe_Electrogene' | 'Autre';
  title: string;
  location: string;
  targetMonth: string; // YYYY-MM
  scheduledDate: string; // YYYY-MM-DD
  assignedTo?: string;
  status: 'Scheduled' | 'In_Progress' | 'Completed' | 'Overdue';
  description?: string;
  completedAt?: Timestamp;
  completedBy?: string;
  reportNotes?: string;
  createdAt: Timestamp;
  createdById: string;
  createdByName: string;
}

export interface GEDailyData {
  id?: string;
  name?: string;
  fuelLevelPercent: number; // 0-100
  fuelLevelLiters?: number;
  engineHours: number;
  oilLevel: 'OK' | 'Low' | 'Critical';
  batteryStatus: 'OK' | 'Weak' | 'Bad';
  generalStatus: 'OK' | 'Anomaly';
  notes?: string;
}

export interface BacheDailyData {
  waterClarity: 'Limpide' | 'Légèrement trouble' | 'Trouble';
  waterLevelPercent: number; // 0-100
  phLevel?: number;
  pumpStatus: 'Normal' | 'Avertissement' | 'Panne';
  pressureBar?: number;
  notes?: string;
}

export interface PoolDailyData {
  phLevel: number;
  chlorinePpm: number;
  waterClarity: 'Limpide' | 'Trouble' | 'Présence d\'algues' | 'Feuilles/Dépôts';
  filtrationHours: number;
  pumpStatus: 'En Marche' | 'Arrêt' | 'Problème';
  chemicalTreatment?: string;
  notes?: string;
}

export interface DailyMaintenanceChecklist {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: Timestamp;
  technicianId: string;
  technicianName: string;
  geData?: GEDailyData;
  geDataList?: GEDailyData[];
  bacheData?: BacheDailyData;
  poolData?: PoolDailyData;
  updatedAt?: Timestamp;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: Timestamp;
  channelId: string; // 'general', 'reception', 'kitchen', 'maintenance', or 'userAId_userBId'
  readBy?: string[];
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  imageUrl?: string;
  isSystem?: boolean;
}

export interface ShishaProduct {
  id: string;
  name: string;
  flavor?: string;
  price: number;
  stock: number;
  category: 'Classic' | 'Special' | 'VIP' | 'Charcoal' | 'Accessory';
  alertStock?: number;
}

export interface ShishaSaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ShishaSale {
  id: string;
  ticketId: string;
  items: ShishaSaleItem[];
  totalAmount: number;
  paymentMethod: 'Espèces' | 'Carte' | 'Chambre' | string;
  tableNumber?: string;
  sellerId: string;
  sellerName: string;
  sellerRole?: string;
  timestamp: Timestamp;
  notes?: string;
  roomId?: string;
  roomNumber?: string;
}

export interface WarehouseProduct {
  id: string;
  name: string;
  reference?: string;
  category: string;
  unit: string; // ex: Bouteille, Carton, Kg, Pièce, Pack
  stock: number;
  quantity?: number;
  minStock: number;
  minQuantity?: number;
  buyPrice: number;
  sellPrice: number;
}

export interface WarehouseMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT'; // IN = Achats / Fournisseur, OUT = Transfert vers Point de Vente
  quantity: number;
  totalCost?: number;
  destinationLocation?: string; // Terrasse, VIP, Réception, Restaurant, etc.
  supplierName?: string; // Pour les entrées fournisseurs
  invoiceNumber?: string;
  timestamp: Timestamp;
  userId: string;
  userName: string;
  notes?: string;
}

