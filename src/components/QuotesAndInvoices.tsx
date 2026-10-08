import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  QuoteInvoice, 
  QuoteInvoiceItem, 
  DocumentType, 
  DocumentStatus, 
  AppSettings, 
  UserProfile, 
  Product, 
  Room, 
  Hall, 
  Guest 
} from '../types';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Eye, 
  Edit, 
  Trash2, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Building2, 
  User, 
  Calendar, 
  DollarSign, 
  FileText, 
  Send, 
  Sparkles, 
  X, 
  PlusCircle, 
  ChevronRight, 
  Copy, 
  Check, 
  Info,
  Layers,
  Bed,
  LayoutGrid,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { generateQuoteInvoicePDF } from '../lib/pdfUtils';
import { handleFirestoreError, OperationType, logEvent } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';

interface QuotesAndInvoicesProps {
  user: UserProfile;
  settings: AppSettings | null;
  products?: Product[];
  rooms?: Room[];
  halls?: Hall[];
  guests?: Guest[];
}

export default function QuotesAndInvoices({ 
  user, 
  settings, 
  products = [], 
  rooms = [], 
  halls = [], 
  guests = [] 
}: QuotesAndInvoicesProps) {
  const [documents, setDocuments] = useState<QuoteInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & View State
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'quotes' | 'invoices'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<QuoteInvoice | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<QuoteInvoice | null>(null);

  // Form State
  const [docType, setDocType] = useState<DocumentType>('Quote');
  const [docNumber, setDocNumber] = useState('');
  const [docStatus, setDocStatus] = useState<DocumentStatus>('Brouillon');
  
  // Hotel Reference Overrides (Defaulted to settings)
  const [hotelName, setHotelName] = useState(settings?.hotelName || 'Hôtel & Résidence HQ');
  const [hotelAddress, setHotelAddress] = useState(settings?.address || "02 rue Daniel Mayinguidi, Massissia (derrière l'usine GO Fresh), Brazzaville");
  const [hotelPhone, setHotelPhone] = useState(settings?.phone || '+221 33 800 00 00 / +221 77 000 00 00');
  const [hotelEmail, setHotelEmail] = useState(settings?.email || 'contact@hotel-residence.com');
  const [hotelNifRccm, setHotelNifRccm] = useState(settings?.nifRccm || 'NIF: 009876543 - RCCM: SN-DKR-2026-B-888');
  const [bankDetails, setBankDetails] = useState(settings?.bankDetails || 'Banque: BOA | Compte: 010012345678 | Wave / OM: +221 77 000 00 00');

  // Client State
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientNifRccm, setClientNifRccm] = useState('');

  // Dates
  const [docDate, setDocDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [validUntilDate, setValidUntilDate] = useState(
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [dueDate, setDueDate] = useState(
    format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );

  // Items State
  const [items, setItems] = useState<QuoteInvoiceItem[]>([
    {
      id: '1',
      description: 'Hébergement - Chambre de Luxe (3 nuitées)',
      category: 'Hébergement',
      quantity: 3,
      unitPrice: 45000,
      total: 135000
    },
    {
      id: '2',
      description: 'Location Grande Salle Polyvalente - Séminaire (2 jours)',
      category: 'Salle & Événements',
      quantity: 2,
      unitPrice: 150000,
      total: 300000
    }
  ]);

  // Financials
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0); // e.g. 0% or 18%
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [paymentTerms, setPaymentTerms] = useState('Acompte de 50% à la commande, solde à la livraison/check-out.');
  const [notes, setNotes] = useState('Offre valable 30 jours. Merci pour votre confiance.');

  // Quick preset selector
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<'room' | 'hall' | 'product' | 'custom'>('custom');

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      if (settings.hotelName) setHotelName(settings.hotelName);
      if (settings.address) setHotelAddress(settings.address);
      if (settings.phone) setHotelPhone(settings.phone);
      if (settings.email) setHotelEmail(settings.email);
      if (settings.nifRccm) setHotelNifRccm(settings.nifRccm);
      if (settings.bankDetails) setBankDetails(settings.bankDetails);
    }
  }, [settings]);

  // Firestore Realtime Listener
  useEffect(() => {
    const q = query(collection(db, 'quotes_invoices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: QuoteInvoice[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as QuoteInvoice));
      setDocuments(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes_invoices');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper to generate reference number
  const generateNewReferenceNumber = (type: DocumentType) => {
    const prefix = type === 'Quote' ? 'DEV' : 'FAC';
    const year = new Date().getFullYear();
    const count = documents.filter(d => d.type === type).length + 1;
    const pad = count.toString().padStart(4, '0');
    return `${prefix}-${year}-${pad}`;
  };

  const handleOpenNewForm = (type: DocumentType = 'Quote') => {
    setEditingDocId(null);
    setDocType(type);
    setDocNumber(generateNewReferenceNumber(type));
    setDocStatus('Brouillon');
    
    // Set Hotel Reference Information from Settings
    setHotelName(settings?.hotelName || 'Hôtel & Résidence HQ');
    setHotelAddress(settings?.address || 'Quartier Central, Avenue de l\'Hôtel');
    setHotelPhone(settings?.phone || '+221 33 800 00 00 / +221 77 000 00 00');
    setHotelEmail(settings?.email || 'contact@hotel-residence.com');
    setHotelNifRccm(settings?.nifRccm || 'NIF: 009876543 - RCCM: SN-DKR-2026-B-888');
    setBankDetails(settings?.bankDetails || 'Banque: BOA | Compte: 010012345678 | Wave / OM: +221 77 000 00 00');

    // Reset Client fields
    setClientName('');
    setClientCompany('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setClientNifRccm('');

    setDocDate(format(new Date(), 'yyyy-MM-dd'));
    setValidUntilDate(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    setDueDate(format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

    setItems([
      {
        id: 'item-1',
        description: 'Séjour - Chambre Standard (1 nuitée)',
        category: 'Hébergement',
        quantity: 1,
        unitPrice: 35000,
        total: 35000
      }
    ]);

    setDiscountAmount(0);
    setTaxRate(0);
    setAdvancePaid(0);
    setPaymentTerms('Règlement par Espèces, Mobile Money, Chèque ou Virement bancaire.');
    setNotes('Devis établi sous réserve de disponibilité au moment de la confirmation.');

    setIsFormOpen(true);
  };

  const handleOpenEditForm = (docData: QuoteInvoice) => {
    setEditingDocId(docData.id);
    setDocType(docData.type);
    setDocNumber(docData.number);
    setDocStatus(docData.status);

    setHotelName(docData.hotelName || settings?.hotelName || '');
    setHotelAddress(docData.hotelAddress || '');
    setHotelPhone(docData.hotelPhone || '');
    setHotelEmail(docData.hotelEmail || '');
    setHotelNifRccm(docData.hotelNifRccm || '');
    setBankDetails(docData.bankDetails || '');

    setClientName(docData.clientName || '');
    setClientCompany(docData.clientCompany || '');
    setClientPhone(docData.clientPhone || '');
    setClientEmail(docData.clientEmail || '');
    setClientAddress(docData.clientAddress || '');
    setClientNifRccm(docData.clientNifRccm || '');

    setDocDate(docData.date || format(new Date(), 'yyyy-MM-dd'));
    setValidUntilDate(docData.validUntilDate || '');
    setDueDate(docData.dueDate || '');

    setItems(docData.items || []);
    setDiscountAmount(docData.discountAmount || 0);
    setTaxRate(docData.taxRate || 0);
    setAdvancePaid(docData.advancePaid || 0);
    setPaymentTerms(docData.paymentTerms || '');
    setNotes(docData.notes || '');

    setIsFormOpen(true);
  };

  // Calculations
  const calculateSubtotal = () => {
    return items.reduce((acc, item) => acc + (item.total || 0), 0);
  };

  const calculateTaxAmount = () => {
    const sub = calculateSubtotal() - discountAmount;
    if (sub <= 0) return 0;
    return Math.round(sub * (taxRate / 100));
  };

  const calculateTotalTTC = () => {
    const sub = calculateSubtotal() - discountAmount;
    const tax = calculateTaxAmount();
    return Math.max(0, sub + tax);
  };

  // Item Table Mutators
  const handleAddItem = () => {
    const newItem: QuoteInvoiceItem = {
      id: `item-${Date.now()}`,
      description: 'Nouvelle prestation / service',
      category: 'Prestation',
      quantity: 1,
      unitPrice: 10000,
      total: 10000
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof QuoteInvoiceItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const q = field === 'quantity' ? Number(value) || 0 : item.quantity;
          const p = field === 'unitPrice' ? Number(value) || 0 : item.unitPrice;
          updated.total = q * p;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.warning("Le document doit contenir au moins une ligne.");
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  // Presets importers
  const handleImportRoom = (room: Room) => {
    const newItem: QuoteInvoiceItem = {
      id: `room-${Date.now()}`,
      description: `Hébergement - Chambre N°${room.number} (${room.type})`,
      category: 'Hébergement',
      quantity: 1,
      unitPrice: room.price || 0,
      total: room.price || 0
    };
    setItems([...items, newItem]);
    toast.success(`Chambre N°${room.number} ajoutée au devis/facture.`);
  };

  const handleImportHall = (hall: Hall) => {
    const newItem: QuoteInvoiceItem = {
      id: `hall-${Date.now()}`,
      description: `Location Salle - ${hall.name} (${hall.type})`,
      category: 'Salle & Événements',
      quantity: 1,
      unitPrice: hall.price || 0,
      total: hall.price || 0
    };
    setItems([...items, newItem]);
    toast.success(`${hall.name} ajouté au devis/facture.`);
  };

  const handleImportProduct = (prod: Product) => {
    const newItem: QuoteInvoiceItem = {
      id: `prod-${Date.now()}`,
      description: `Article / Restauration - ${prod.name}`,
      category: prod.category || 'Restauration',
      quantity: 1,
      unitPrice: prod.price || 0,
      total: prod.price || 0
    };
    setItems([...items, newItem]);
    toast.success(`${prod.name} ajouté au devis/facture.`);
  };

  const handleSelectClientFromGuest = (guest: Guest) => {
    setClientName(guest.name || '');
    if (guest.phone) setClientPhone(guest.phone);
    if (guest.email) setClientEmail(guest.email);
    toast.info(`Client ${guest.name} sélectionné.`);
  };

  // Submit Save
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      toast.error("Veuillez saisir le nom du client.");
      return;
    }

    if (items.length === 0) {
      toast.error("Veuillez ajouter au moins une prestation.");
      return;
    }

    const subtotal = calculateSubtotal();
    const taxAmount = calculateTaxAmount();
    const totalAmount = calculateTotalTTC();

    const payload = {
      number: docNumber,
      type: docType,
      status: docStatus,

      // Hotel References
      hotelName: hotelName || settings?.hotelName || 'Résidence HQ',
      hotelAddress,
      hotelPhone,
      hotelEmail,
      hotelNifRccm,
      hotelLogoUrl: settings?.logoUrl || '/logo.png',

      // Client
      clientName: clientName.trim(),
      clientCompany: clientCompany.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      clientAddress: clientAddress.trim(),
      clientNifRccm: clientNifRccm.trim(),

      // Dates
      date: docDate,
      validUntilDate: docType === 'Quote' ? validUntilDate : '',
      dueDate: docType === 'Invoice' ? dueDate : '',

      // Financials
      items,
      subtotal,
      taxRate: Number(taxRate) || 0,
      taxAmount,
      discountAmount: Number(discountAmount) || 0,
      totalAmount,
      advancePaid: Number(advancePaid) || 0,

      paymentTerms,
      notes,
      bankDetails,

      createdBy: user.username,
      createdById: user.id,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingDocId) {
        await updateDoc(doc(db, 'quotes_invoices', editingDocId), payload);
        logEvent(user, 'Devis & Factures', `Modification du document ${docNumber} (${docType})`);
        toast.success(`Document ${docNumber} mis à jour avec succès !`);
      } else {
        await addDoc(collection(db, 'quotes_invoices'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        logEvent(user, 'Devis & Factures', `Création du document ${docNumber} (${docType}) pour ${clientName}`);
        toast.success(`${docType === 'Quote' ? 'Devis' : 'Facture'} ${docNumber} créé avec succès !`);
      }

      setIsFormOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingDocId ? OperationType.UPDATE : OperationType.CREATE, 'quotes_invoices');
    }
  };

  // Convert Quote to Invoice
  const handleConvertQuoteToInvoice = async (quote: QuoteInvoice) => {
    try {
      const newInvoiceNumber = generateNewReferenceNumber('Invoice');
      
      const invoicePayload = {
        number: newInvoiceNumber,
        type: 'Invoice' as DocumentType,
        status: 'Validé' as DocumentStatus,

        hotelName: quote.hotelName,
        hotelAddress: quote.hotelAddress,
        hotelPhone: quote.hotelPhone,
        hotelEmail: quote.hotelEmail,
        hotelNifRccm: quote.hotelNifRccm,
        hotelLogoUrl: quote.hotelLogoUrl,

        clientName: quote.clientName,
        clientCompany: quote.clientCompany,
        clientPhone: quote.clientPhone,
        clientEmail: quote.clientEmail,
        clientAddress: quote.clientAddress,
        clientNifRccm: quote.clientNifRccm,

        date: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),

        items: quote.items,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate || 0,
        taxAmount: quote.taxAmount || 0,
        discountAmount: quote.discountAmount || 0,
        totalAmount: quote.totalAmount,
        advancePaid: quote.advancePaid || 0,

        paymentTerms: quote.paymentTerms,
        notes: quote.notes,
        bankDetails: quote.bankDetails,

        createdBy: user.username,
        createdById: user.id,
        createdAt: serverTimestamp(),
        convertedFromQuoteId: quote.id
      };

      // Add Invoice
      const docRef = await addDoc(collection(db, 'quotes_invoices'), invoicePayload);

      // Update Quote Status to Validé
      await updateDoc(doc(db, 'quotes_invoices', quote.id), {
        status: 'Validé',
        convertedInvoiceId: docRef.id,
        updatedAt: serverTimestamp()
      });

      logEvent(user, 'Devis & Factures', `Conversion du devis ${quote.number} en facture ${newInvoiceNumber}`);
      toast.success(`Devis ${quote.number} converti avec succès en Facture ${newInvoiceNumber} !`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quotes_invoices');
    }
  };

  // Change status
  const handleChangeStatus = async (docId: string, newStatus: DocumentStatus, number: string) => {
    try {
      await updateDoc(doc(db, 'quotes_invoices', docId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      logEvent(user, 'Devis & Factures', `Changement de statut du document ${number} -> ${newStatus}`);
      toast.success(`Statut mis à jour : ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `quotes_invoices/${docId}`);
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    const { id: docId, number, type } = docToDelete;

    try {
      await deleteDoc(doc(db, 'quotes_invoices', docId));
      logEvent(user, 'Devis & Factures', `Suppression du document ${number} (${type})`);
      toast.success(`${type === 'Quote' ? 'Devis' : 'Facture'} ${number} supprimé(e) avec succès.`);
      if (viewingDoc?.id === docId) setViewingDoc(null);
      setDocToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quotes_invoices/${docId}`);
    }
  };

  // Filtered List
  const filteredDocs = documents.filter(docItem => {
    if (activeSubTab === 'quotes' && docItem.type !== 'Quote') return false;
    if (activeSubTab === 'invoices' && docItem.type !== 'Invoice') return false;

    if (statusFilter !== 'All' && docItem.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = docItem.number.toLowerCase().includes(q);
      const matchClient = docItem.clientName.toLowerCase().includes(q);
      const matchComp = docItem.clientCompany?.toLowerCase().includes(q) || false;
      return matchNum || matchClient || matchComp;
    }

    return true;
  });

  // Calculate quick stats
  const totalQuotesCount = documents.filter(d => d.type === 'Quote').length;
  const totalInvoicesCount = documents.filter(d => d.type === 'Invoice').length;
  const totalInvoicesPaidSum = documents
    .filter(d => d.type === 'Invoice' && d.status === 'Payé')
    .reduce((acc, d) => acc + (d.totalAmount || 0), 0);
  const totalInvoicesPendingSum = documents
    .filter(d => d.type === 'Invoice' && d.status !== 'Payé' && d.status !== 'Annulé')
    .reduce((acc, d) => acc + (d.totalAmount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header - Vivid Blue Theme */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-15 pointer-events-none">
          <FileSpreadsheet className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Module Officiel d'Établissement</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Devis & Factures de l'Hôtel
            </h1>
            <p className="text-blue-100/80 text-xs md:text-sm max-w-2xl leading-relaxed">
              Générez, stockez et imprimez les devis proforma et factures officielles préconçus avec l'entête, le logo et toutes les références légales de l'établissement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => handleOpenNewForm('Quote')}
              className="px-5 py-3 bg-white hover:bg-blue-50 text-blue-800 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer hover:scale-105"
            >
              <Plus className="w-4 h-4 text-blue-700" />
              Nouveau Devis
            </button>
            <button
              onClick={() => handleOpenNewForm('Invoice')}
              className="px-5 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer hover:scale-105 border border-blue-300/30"
            >
              <FileText className="w-4 h-4" />
              Nouvelle Facture
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs border border-white/10">
            <p className="text-blue-200 text-[10px] uppercase tracking-wider font-bold">Total Devis</p>
            <p className="text-lg font-bold text-white mt-0.5">{totalQuotesCount} enregistrés</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs border border-white/10">
            <p className="text-blue-200 text-[10px] uppercase tracking-wider font-bold">Total Factures</p>
            <p className="text-lg font-bold text-white mt-0.5">{totalInvoicesCount} éjectées</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs border border-white/10">
            <p className="text-blue-200 text-[10px] uppercase tracking-wider font-bold">Encaissements Payés</p>
            <p className="text-lg font-bold text-emerald-300 mt-0.5">{totalInvoicesPaidSum.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs border border-white/10">
            <p className="text-blue-200 text-[10px] uppercase tracking-wider font-bold">Encaissements En Attente</p>
            <p className="text-lg font-bold text-amber-300 mt-0.5">{totalInvoicesPendingSum.toLocaleString()} FCFA</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Subtabs & Search */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-blue-50/80 p-1.5 rounded-xl border border-blue-100 w-full md:w-auto shrink-0">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'all' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-blue-800 hover:bg-blue-100/60'
            }`}
          >
            Tous ({documents.length})
          </button>
          <button
            onClick={() => setActiveSubTab('quotes')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'quotes' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-blue-800 hover:bg-blue-100/60'
            }`}
          >
            Devis ({totalQuotesCount})
          </button>
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'invoices' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-blue-800 hover:bg-blue-100/60'
            }`}
          >
            Factures ({totalInvoicesCount})
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher client, N°..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-blue-50/40 border border-blue-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#2B2321]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-blue-50/40 border border-blue-100 rounded-xl px-3 py-2 text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto cursor-pointer"
            >
              <option value="All">Tous Statuts</option>
              <option value="Brouillon">Brouillon</option>
              <option value="Envoyé">Envoyé</option>
              <option value="Validé">Validé</option>
              <option value="Payé">Payé</option>
              <option value="Annulé">Annulé</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Documents Table List */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-blue-600 text-sm font-bold animate-pulse">
            Chargement de la base des devis et factures...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-[#2B2321]/60 space-y-3">
            <FileSpreadsheet className="w-12 h-12 text-blue-300 mx-auto opacity-50" />
            <p className="font-bold text-base text-[#2B2321]">Aucun document trouvé</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'All' 
                ? 'Essayez de modifier vos critères de recherche.' 
                : 'Créez votre premier devis ou votre première facture officielle dès maintenant.'}
            </p>
            <button
              onClick={() => handleOpenNewForm('Quote')}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Créer un devis
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-blue-50/70 border-b border-blue-100 text-blue-900 uppercase font-extrabold tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Type & Reference</th>
                  <th className="p-4">Client / Entreprise</th>
                  <th className="p-4">Date Émission</th>
                  <th className="p-4 text-right">Montant Total TTC</th>
                  <th className="p-4 text-center">Statut</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50 text-[#2B2321]">
                {filteredDocs.map((docData) => {
                  const isQuote = docData.type === 'Quote';
                  return (
                    <tr key={docData.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                            isQuote ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isQuote ? 'Devis' : 'Facture'}
                          </span>
                          <div>
                            <p className="font-extrabold text-blue-900 text-sm">{docData.number}</p>
                            <p className="text-[10px] text-gray-500">Par {docData.createdBy}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-bold text-[#2B2321]">{docData.clientName}</p>
                        {docData.clientCompany && (
                          <p className="text-[10px] text-blue-600 font-medium">{docData.clientCompany}</p>
                        )}
                        {docData.clientPhone && (
                          <p className="text-[10px] text-gray-500">{docData.clientPhone}</p>
                        )}
                      </td>

                      <td className="p-4 text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          <span>{docData.date}</span>
                        </div>
                        {isQuote && docData.validUntilDate && (
                          <p className="text-[10px] text-amber-600 font-medium mt-0.5">Val: {docData.validUntilDate}</p>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <p className="font-black text-blue-900 text-sm">
                          {(docData.totalAmount || 0).toLocaleString()} FCFA
                        </p>
                        {docData.advancePaid ? (
                          <p className="text-[10px] text-emerald-600 font-bold">
                            Acompte: {(docData.advancePaid).toLocaleString()} F
                          </p>
                        ) : null}
                      </td>

                      <td className="p-4 text-center">
                        <select
                          value={docData.status}
                          onChange={(e) => handleChangeStatus(docData.id, e.target.value as DocumentStatus, docData.number)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer border focus:outline-none ${
                            docData.status === 'Payé' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            docData.status === 'Validé' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            docData.status === 'Envoyé' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            docData.status === 'Annulé' ? 'bg-red-100 text-red-800 border-red-300' :
                            'bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                        >
                          <option value="Brouillon">Brouillon</option>
                          <option value="Envoyé">Envoyé</option>
                          <option value="Validé">Validé</option>
                          <option value="Payé">Payé</option>
                          <option value="Annulé">Annulé</option>
                        </select>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Convert Quote to Invoice button */}
                          {isQuote && docData.status !== 'Annulé' && (
                            <button
                              onClick={() => handleConvertQuoteToInvoice(docData)}
                              title="Convertir en Facture"
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <ArrowRight className="w-3 h-3" />
                              <span className="hidden sm:inline">Facturer</span>
                            </button>
                          )}

                          {/* Preview / Print */}
                          <button
                            onClick={() => setViewingDoc(docData)}
                            title="Aperçu & Imprimer"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer border border-blue-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* PDF Download */}
                          <button
                            onClick={() => generateQuoteInvoicePDF(docData, settings)}
                            title="Télécharger PDF"
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer border border-indigo-200"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEditForm(docData)}
                            title="Éditer"
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer border border-amber-200"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDocToDelete(docData)}
                            title="Supprimer"
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer border border-red-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT FORM MODAL WITH LIVE HOTEL MAQUETTE PREVIEW */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 lg:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-blue-200 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <FileSpreadsheet className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <h2 className="font-bold text-base md:text-lg">
                    {editingDocId ? 'Édition du document' : docType === 'Quote' ? 'Création d\'un Nouveau Devis Proforma' : 'Création d\'une Nouvelle Facture'}
                  </h2>
                  <p className="text-xs text-blue-200">
                    Saisissez les informations ou importez depuis le stock, chambres ou salles.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form & Maquette Body */}
            <form onSubmit={handleSaveDocument} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-[#2B2321]">
              
              {/* Top Controls: Type & Number */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-blue-900 mb-1">
                    Type de Document
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => {
                      const newType = e.target.value as DocumentType;
                      setDocType(newType);
                      if (!editingDocId) {
                        setDocNumber(generateNewReferenceNumber(newType));
                      }
                    }}
                    className="w-full bg-white border border-blue-200 rounded-lg p-2 font-bold text-blue-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Quote">Devis Proforma</option>
                    <option value="Invoice">Facture Officielle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-blue-900 mb-1">
                    N° Référence Document
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-lg p-2 font-bold text-blue-900 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-blue-900 mb-1">
                    Date Émission
                  </label>
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-blue-900 mb-1">
                    {docType === 'Quote' ? 'Validité Jusqu\'au' : 'Date Échéance'}
                  </label>
                  <input
                    type="date"
                    value={docType === 'Quote' ? validUntilDate : dueDate}
                    onChange={(e) => docType === 'Quote' ? setValidUntilDate(e.target.value) : setDueDate(e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* HOTEL PRE-CONCEIVED HEADER & CLIENT SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Hotel Header References Box */}
                <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-4 rounded-xl border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                    <h3 className="font-extrabold text-blue-900 uppercase text-[11px] flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Entête Officielle de l'Hôtel (Références Pre-conçues)
                    </h3>
                    <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                      Maquette Pré-paramétrée
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Nom de l'Établissement</label>
                      <input
                        type="text"
                        value={hotelName}
                        onChange={(e) => setHotelName(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5 font-bold text-blue-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Téléphone Contact</label>
                      <input
                        type="text"
                        value={hotelPhone}
                        onChange={(e) => setHotelPhone(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Email Officiel</label>
                      <input
                        type="text"
                        value={hotelEmail}
                        onChange={(e) => setHotelEmail(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600">NIF / RCCM / Agrément</label>
                      <input
                        type="text"
                        value={hotelNifRccm}
                        onChange={(e) => setHotelNifRccm(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-gray-600">Adresse / Localisation</label>
                      <input
                        type="text"
                        value={hotelAddress}
                        onChange={(e) => setHotelAddress(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Client Box */}
                <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                    <h3 className="font-extrabold text-blue-900 uppercase text-[11px] flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-600" />
                      Informations du Client / Destinataire
                    </h3>
                    
                    {/* Guest Quick Picker */}
                    {guests.length > 0 && (
                      <select
                        onChange={(e) => {
                          const g = guests.find(item => item.id === e.target.value);
                          if (g) handleSelectClientFromGuest(g);
                        }}
                        className="bg-white border border-blue-300 text-blue-900 text-[10px] font-bold rounded px-2 py-0.5 cursor-pointer"
                      >
                        <option value="">-- Importer depuis le CRM Client --</option>
                        {guests.map(g => (
                          <option key={g.id} value={g.id}>{g.name} {g.phone ? `(${g.phone})` : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Nom Complet du Client *</label>
                      <input
                        type="text"
                        placeholder="ex: M. Mamadou Diallo"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5 font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Entreprise / Organisation</label>
                      <input
                        type="text"
                        placeholder="ex: SENELEC / ONI"
                        value={clientCompany}
                        onChange={(e) => setClientCompany(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Téléphone Client</label>
                      <input
                        type="text"
                        placeholder="+221 77 000 00 00"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Email Client</label>
                      <input
                        type="email"
                        placeholder="client@gmail.com"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-600">NIF / IFU Client</label>
                      <input
                        type="text"
                        placeholder="0012345"
                        value={clientNifRccm}
                        onChange={(e) => setClientNifRccm(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-600">Adresse / Ville</label>
                      <input
                        type="text"
                        placeholder="Dakar, Sénégal"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        className="w-full bg-white border border-blue-200 rounded-md p-1.5"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* QUICK IMPORTERS TOOLBAR */}
              <div className="bg-blue-600 text-white p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-200" />
                  <span className="font-extrabold uppercase text-[11px] tracking-wider">
                    Importer rapidement des prestations :
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Room Quick Import */}
                  {rooms.length > 0 && (
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const r = rooms.find(item => item.id === e.target.value);
                          if (r) handleImportRoom(r);
                          e.target.value = '';
                        }}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none"
                      >
                        <option value="" className="text-black">+ Importer une Chambre</option>
                        {rooms.map(r => (
                          <option key={r.id} value={r.id} className="text-black">
                            Chambre {r.number} - {r.type} ({r.price?.toLocaleString()} F)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Hall Quick Import */}
                  {halls.length > 0 && (
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const h = halls.find(item => item.id === e.target.value);
                          if (h) handleImportHall(h);
                          e.target.value = '';
                        }}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none"
                      >
                        <option value="" className="text-black">+ Importer une Salle</option>
                        {halls.map(h => (
                          <option key={h.id} value={h.id} className="text-black">
                            {h.name} - {h.type} ({h.price?.toLocaleString()} F)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Product Quick Import */}
                  {products.length > 0 && (
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const p = products.find(item => item.id === e.target.value);
                          if (p) handleImportProduct(p);
                          e.target.value = '';
                        }}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-[10px] font-bold rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none"
                      >
                        <option value="" className="text-black">+ Importer du Stock/Service</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id} className="text-black">
                            {p.name} ({p.price?.toLocaleString()} F)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-white text-blue-800 hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-700" />
                    Ligne sur mesure
                  </button>
                </div>
              </div>

              {/* ITEMS TABLE */}
              <div className="border border-blue-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-blue-50 border-b border-blue-200 text-blue-900 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 w-8 text-center">#</th>
                      <th className="p-3">Désignation / Description de la Prestation</th>
                      <th className="p-3 w-36">Catégorie</th>
                      <th className="p-3 w-20 text-center">Qté</th>
                      <th className="p-3 w-32 text-right">Prix Unitaire (F)</th>
                      <th className="p-3 w-36 text-right">Total HT (F)</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 bg-white">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-3 text-center font-bold text-gray-500">{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-md p-1.5 font-medium text-xs focus:ring-1 focus:ring-blue-500"
                            placeholder="ex: Séjour 2 nuits suite VIP"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.category || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-md p-1.5 text-xs"
                            placeholder="Hébergement, Traiteur..."
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                            className="w-16 text-center bg-white border border-gray-200 rounded-md p-1.5 font-bold"
                            required
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                            className="w-28 text-right bg-white border border-gray-200 rounded-md p-1.5 font-bold"
                            required
                          />
                        </td>
                        <td className="p-3 text-right font-black text-blue-900 text-sm">
                          {(item.total || 0).toLocaleString()} F
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* BOTTOM TOTALS & LEGAL TERMS SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                
                {/* Legal Terms & Bank Details */}
                <div className="space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-200">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-blue-900 mb-1">
                      Conditions de Règlement & Modalités
                    </label>
                    <textarea
                      rows={2}
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full bg-white border border-blue-200 rounded-md p-2 text-xs"
                      placeholder="Modalités de paiement..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-blue-900 mb-1">
                      Coordonnées Bancaires & Mobile Money
                    </label>
                    <input
                      type="text"
                      value={bankDetails}
                      onChange={(e) => setBankDetails(e.target.value)}
                      className="w-full bg-white border border-blue-200 rounded-md p-2 text-xs font-mono"
                      placeholder="RIB / Wave / OM..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-blue-900 mb-1">
                      Notes & Observations
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-white border border-blue-200 rounded-md p-2 text-xs"
                      placeholder="Offre valable 30 jours..."
                    />
                  </div>
                </div>

                {/* Totals Summary Card */}
                <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 rounded-xl space-y-3 shadow-md flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-blue-200">
                      <span>Sous-total HT :</span>
                      <span className="font-bold text-white text-sm">{calculateSubtotal().toLocaleString()} FCFA</span>
                    </div>

                    <div className="flex justify-between items-center gap-2 text-xs">
                      <span className="text-blue-200">Remise Commerciale (FCFA) :</span>
                      <input
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                        className="w-28 text-right bg-white/10 border border-white/20 rounded p-1 font-bold text-white text-xs"
                      />
                    </div>

                    <div className="flex justify-between items-center gap-2 text-xs">
                      <span className="text-blue-200">Taux TVA (%) :</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                        className="w-20 text-right bg-white/10 border border-white/20 rounded p-1 font-bold text-white text-xs"
                      />
                    </div>

                    {taxRate > 0 && (
                      <div className="flex justify-between items-center text-xs text-blue-200">
                        <span>Montant TVA ({taxRate}%) :</span>
                        <span className="font-bold">{calculateTaxAmount().toLocaleString()} FCFA</span>
                      </div>
                    )}

                    <div className="border-t border-white/20 my-2 pt-2 flex justify-between items-center">
                      <span className="font-extrabold text-sm uppercase text-blue-200">Total TTC :</span>
                      <span className="font-black text-2xl text-emerald-400">
                        {calculateTotalTTC().toLocaleString()} FCFA
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-2 text-xs pt-1">
                      <span className="text-blue-200">Acompte Réceptionné (FCFA) :</span>
                      <input
                        type="number"
                        min="0"
                        value={advancePaid}
                        onChange={(e) => setAdvancePaid(Number(e.target.value) || 0)}
                        className="w-28 text-right bg-white/10 border border-white/20 rounded p-1 font-bold text-emerald-300 text-xs"
                      />
                    </div>

                    {advancePaid > 0 && (
                      <div className="flex justify-between items-center text-xs text-amber-300 pt-1 font-bold">
                        <span>Net Restant à Payer :</span>
                        <span>{Math.max(0, calculateTotalTTC() - advancePaid).toLocaleString()} FCFA</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/20 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 hover:bg-white/10 rounded-xl text-xs font-bold transition-all text-white cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {editingDocId ? 'Enregistrer les Modifications' : 'Enregistrer dans la Base'}
                    </button>
                  </div>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW / PRINT MODAL (Paper A4 Preview) */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 lg:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-blue-200">
            {/* Modal Actions Bar */}
            <div className="bg-blue-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-300" />
                <span className="font-extrabold text-sm">
                  Aperçu Document - {viewingDoc.number} ({viewingDoc.type === 'Quote' ? 'Devis Proforma' : 'Facture'})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => generateQuoteInvoicePDF(viewingDoc, settings)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimer
                </button>
                <button
                  onClick={() => setDocToDelete(viewingDoc)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Paper Sheet Preview */}
            <div className="p-8 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
              <div className="bg-white w-full max-w-3xl shadow-xl border border-slate-200 rounded-sm p-8 space-y-6 text-[#2B2321] text-xs font-sans">
                
                {/* Header Top Blue Accent */}
                <div className="h-1.5 bg-blue-700 -mx-8 -mt-8 mb-6 rounded-t-sm" />

                {/* Hotel Header & Document Type */}
                <div className="flex justify-between items-start gap-6 border-b border-slate-200 pb-6">
                  <div>
                    <h1 className="text-xl font-extrabold text-blue-800 uppercase tracking-tight">
                      {viewingDoc.hotelName || settings?.hotelName || 'Résidence HQ Hôtel'}
                    </h1>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {viewingDoc.hotelAddress || settings?.address || 'Hôtel • Restaurant • Séjour & Événementiel'}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      {viewingDoc.hotelPhone || settings?.phone} | {viewingDoc.hotelEmail || settings?.email}
                    </p>
                    <p className="text-slate-500 text-[10px] font-mono mt-1">
                      {viewingDoc.hotelNifRccm || settings?.nifRccm}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-900 font-black text-sm uppercase tracking-wider rounded-md mb-1">
                      {viewingDoc.type === 'Quote' ? 'DEVIS PROFORMA' : 'FACTURE DE PRESTATION'}
                    </span>
                    <p className="font-extrabold text-slate-800 text-sm">N° {viewingDoc.number}</p>
                    <p className="text-slate-500 text-[11px]">Date : {viewingDoc.date}</p>
                    {viewingDoc.type === 'Quote' && viewingDoc.validUntilDate && (
                      <p className="text-amber-700 font-bold text-[10px]">Valable jusqu'au : {viewingDoc.validUntilDate}</p>
                    )}
                    {viewingDoc.type === 'Invoice' && viewingDoc.dueDate && (
                      <p className="text-slate-600 font-medium text-[10px]">Échéance : {viewingDoc.dueDate}</p>
                    )}
                  </div>
                </div>

                {/* Client Info Block */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-extrabold uppercase text-blue-800 mb-1">DESTINATAIRE / CLIENT :</p>
                  <p className="font-bold text-sm text-slate-900">
                    {viewingDoc.clientName} {viewingDoc.clientCompany ? `(${viewingDoc.clientCompany})` : ''}
                  </p>
                  <div className="text-slate-600 text-[11px] flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {viewingDoc.clientPhone && <span>Tél: {viewingDoc.clientPhone}</span>}
                    {viewingDoc.clientEmail && <span>Email: {viewingDoc.clientEmail}</span>}
                    {viewingDoc.clientAddress && <span>Adresse: {viewingDoc.clientAddress}</span>}
                    {viewingDoc.clientNifRccm && <span>NIF/IFU: {viewingDoc.clientNifRccm}</span>}
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-blue-800 text-white font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="p-3 w-8 text-center">#</th>
                        <th className="p-3">Désignation / Description</th>
                        <th className="p-3">Catégorie</th>
                        <th className="p-3 text-center">Qté</th>
                        <th className="p-3 text-right">Prix Unitaire</th>
                        <th className="p-3 text-right">Montant Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {viewingDoc.items.map((item, idx) => (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-900">{item.description}</td>
                          <td className="p-3 text-slate-500">{item.category || '-'}</td>
                          <td className="p-3 text-center font-bold">{item.quantity}</td>
                          <td className="p-3 text-right">{item.unitPrice.toLocaleString()} F</td>
                          <td className="p-3 text-right font-black text-slate-900">{item.total.toLocaleString()} F</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals & Notes */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
                  <div className="space-y-2 text-[11px] text-slate-600 max-w-xs">
                    <p className="font-extrabold text-blue-800 uppercase text-[10px]">MODALITÉS & RÈGLEMENT :</p>
                    <p className="bg-slate-50 p-2.5 rounded border border-slate-200">{viewingDoc.bankDetails || 'Coordonnées bancaires disponibles sur demande.'}</p>
                    <p className="italic text-[10px]">{viewingDoc.paymentTerms}</p>
                    {viewingDoc.notes && <p className="text-[10px] text-slate-500">Note: {viewingDoc.notes}</p>}
                  </div>

                  <div className="w-full sm:w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-800">
                    <div className="flex justify-between">
                      <span>Sous-total HT :</span>
                      <span className="font-bold">{viewingDoc.subtotal.toLocaleString()} F</span>
                    </div>

                    {viewingDoc.discountAmount ? (
                      <div className="flex justify-between text-slate-600">
                        <span>Remise :</span>
                        <span>-{viewingDoc.discountAmount.toLocaleString()} F</span>
                      </div>
                    ) : null}

                    {viewingDoc.taxRate ? (
                      <div className="flex justify-between text-slate-600">
                        <span>TVA ({viewingDoc.taxRate}%) :</span>
                        <span>{(viewingDoc.taxAmount || 0).toLocaleString()} F</span>
                      </div>
                    ) : null}

                    <div className="border-t border-slate-300 pt-2 flex justify-between font-black text-sm text-blue-900">
                      <span>TOTAL TTC :</span>
                      <span>{viewingDoc.totalAmount.toLocaleString()} FCFA</span>
                    </div>

                    {viewingDoc.advancePaid ? (
                      <div className="flex justify-between text-emerald-700 font-bold pt-1 text-[11px]">
                        <span>Acompte versé :</span>
                        <span>{viewingDoc.advancePaid.toLocaleString()} F</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Signature Block */}
                <div className="pt-8 flex justify-between items-end text-[10px] text-slate-500 border-t border-slate-200">
                  <div>
                    <p>Document établi par : <span className="font-bold text-slate-800">{viewingDoc.createdBy}</span></p>
                    <p className="italic">Merci pour votre confiance & partenariat.</p>
                  </div>

                  <div className="text-center border border-dashed border-slate-300 rounded p-4 w-48">
                    <p className="font-bold text-slate-700 mb-6">Cachet & Signature</p>
                    <p className="text-[9px] text-slate-400">La Direction Général</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!docToDelete}
        title={`Supprimer ${docToDelete?.type === 'Quote' ? 'le devis' : 'la facture'}`}
        message={`Êtes-vous sûr de vouloir supprimer définitivement ${docToDelete?.type === 'Quote' ? 'le devis' : 'la facture'} "${docToDelete?.number}" (${docToDelete?.clientName}) ?Cette action est irréversible.`}
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        onConfirm={handleConfirmDelete}
        onClose={() => setDocToDelete(null)}
      />

    </div>
  );
}
