import React, { useState, useEffect } from 'react';
import { Booking, AppSettings } from '../types';
import { Search, Calendar, Bed, Download, History, FileText, Printer, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, OperationType, handleFirestoreError, logEvent } from '../lib/utils';
import { collection, query, orderBy, onSnapshot, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generatePDF } from '../lib/pdfUtils';
import { Receipt as ReceiptModal } from './Receipt';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'sonner';

export const BookingHistory = ({ settings, isAdmin, user }: { settings?: AppSettings | null, isAdmin: boolean, user: any }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedBookingReceipt, setSelectedBookingReceipt] = useState<any | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);

  const isManagerOrAdmin = isAdmin || user?.role === 'admin' || user?.role === 'manager' || user?.email?.toLowerCase() === 'cyber.kan587@gmail.com';

  const executeDeleteBooking = async (booking: Booking) => {
    if (!isManagerOrAdmin) return;

    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      
      const { query, where, getDocs, collection } = await import('firebase/firestore');
      const salesQ = query(collection(db, 'sales'), where('bookingId', '==', booking.id));
      const salesSnap = await getDocs(salesQ);
      for (const saleDoc of salesSnap.docs) {
        await deleteDoc(saleDoc.ref);
      }

      logEvent(user, 'Hôtel', `Historique de séjour #${booking.roomNumber} (Client: ${booking.guestName}) supprimé par ${user.username}.`);
      toast.success("Séjour et ventes associés supprimés.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bookings');
    }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    if (!isManagerOrAdmin) return;
    setBookingToDelete(booking);
  };

  useEffect(() => {
    const q = query(collection(db, 'bookings'), orderBy('checkOutDate', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));
    return () => unsub();
  }, []);

  const filteredBookings = bookings.filter(b => 
    (b.guestName.toLowerCase().includes(search.toLowerCase()) || b.roomNumber.includes(search)) &&
    (!filterDate || format(b.checkOutDate.toDate(), 'yyyy-MM-dd') === filterDate)
  );

  const handleDownloadPDF = () => {
    setIsDownloading(true);
    try {
      const columns = ['Client', 'Chambre', 'Arrivée', 'Départ', 'Nuits', 'Montant (FCFA)', 'Paiement'];
      const rows = filteredBookings.map(b => [
        b.guestName,
        `#${b.roomNumber}`,
        format(b.checkInDate.toDate(), 'dd/MM/yyyy'),
        format(b.checkOutDate.toDate(), 'dd/MM/yyyy'),
        b.totalNights,
        b.totalPaid.toLocaleString(),
        b.paymentMethod
      ]);

      generatePDF({
        title: 'Historique des Séjours et Réservations',
        filename: 'Historique_Sejours',
        columns,
        rows,
        settings,
        orientation: 'l' // Landscape for more columns
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Historique des Séjours</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Registre des check-ins, check-outs et facturation hôtelière</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <input 
              type="date"
              className="pl-10 pr-4 py-2 bg-white border border-secondary/30 rounded-xl outline-none font-bold text-[10px] md:text-xs focus:border-primary"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </div>
          <button 
            onClick={handleDownloadPDF}
            disabled={isDownloading || filteredBookings.length === 0}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-primary text-white rounded-xl font-bold text-[10px] md:text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            title="Exporter en PDF"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span className="hidden md:inline">PDF</span>
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/40" />
        <input 
          placeholder="Rechercher par client ou chambre..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-secondary/30 rounded-2xl outline-none font-bold focus:border-primary transition-all"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white border border-secondary/30 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FDFBF7] border-b border-secondary/20">
                <th className="p-2 md:p-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Client</th>
                <th className="p-2 md:p-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Chambre</th>
                <th className="p-2 md:p-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Période</th>
                <th className="p-2 md:p-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Nuits</th>
                <th className="p-2 md:p-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Total Payé</th>
                <th className="p-2 md:p-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60">Paiement</th>
                <th className="p-2 md:p-4 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-primary/60 text-right">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-[#FDFBF7]/50 transition-colors group">
                  <td className="p-2 md:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center text-primary font-bold">
                        {booking.guestName[0]}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-[#2B2321]">{booking.guestName}</p>
                        <p className="text-[8px] md:text-[10px] font-bold text-primary/40 uppercase tracking-widest">ID: {booking.guestId.slice(-4)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 md:p-4">
                    <div className="flex items-center gap-2">
                      <Bed className="w-4 h-4 text-primary/40" />
                      <span className="font-bold text-[#2B2321]">#{booking.roomNumber}</span>
                    </div>
                  </td>
                  <td className="p-2 md:p-4">
                    <div className="space-y-1">
                      <p className="text-[10px] md:text-xs font-bold text-[#2B2321]">Du {format(booking.checkInDate.toDate(), 'dd MMM yyyy', { locale: fr })}</p>
                      <p className="text-[10px] md:text-xs font-bold text-primary/60 italic">Au {format(booking.checkOutDate.toDate(), 'dd MMM yyyy', { locale: fr })}</p>
                    </div>
                  </td>
                  <td className="p-2 md:p-4">
                    <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest border border-secondary/20">
                      {booking.totalNights} nuits
                    </span>
                  </td>
                  <td className="p-2 md:p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-primary text-sm md:text-lg">{booking.totalPaid.toLocaleString()} FCFA</span>
                      <span className="text-[7px] md:text-[9px] font-bold text-primary/40 uppercase tracking-widest">Chambre: {booking.roomCharge.toLocaleString()} | Extras: {booking.posCharges.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="p-2 md:p-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest border",
                      booking.paymentMethod === 'Cash' ? "bg-accent/10 text-accent border-accent/20" :
                      booking.paymentMethod === 'Card' ? "bg-blue-50 text-blue-600 border-blue-200" :
                      "bg-orange-50 text-orange-600 border-orange-200"
                    )}>
                      {booking.paymentMethod}
                    </span>
                  </td>
                  <td className="p-2 md:p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          const nights = booking.totalNights || 1;
                          setSelectedBookingReceipt({
                            id: `FAC-${booking.id ? booking.id.slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`,
                            timestamp: booking.checkOutDate ? booking.checkOutDate.toDate() : new Date(),
                            guestName: booking.guestName,
                            roomId: booking.roomNumber,
                            location: `Chambre #${booking.roomNumber}`,
                            items: [
                              {
                                productName: `Séjour Chambre #${booking.roomNumber} (${nights} nuit${nights > 1 ? 's' : ''})`,
                                quantity: nights,
                                price: booking.roomCharge / nights
                              },
                              ...(booking.posCharges > 0 ? [{
                                productName: 'Frais Annexes / Consommations',
                                quantity: 1,
                                price: booking.posCharges
                              }] : []),
                              ...(booking.discount ? [{
                                productName: 'Remise / Réduction',
                                quantity: 1,
                                price: -booking.discount
                              }] : [])
                            ],
                            totalPrice: booking.totalPaid,
                            paymentMethod: booking.paymentMethod
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-[10px] md:text-xs transition-colors"
                        title="Imprimer / Afficher la facture de séjour"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Facture</span>
                      </button>

                      {isManagerOrAdmin && (
                        <button 
                          onClick={() => handleDeleteBooking(booking)}
                          className="p-1.5 md:p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors"
                          title="Supprimer l'historique"
                        >
                          <Trash2 className="w-3.5 h-3.5 md:w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredBookings.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-[#FDFBF7] rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-10 h-10 text-primary/20" />
            </div>
            <p className="text-[#2B2321]/60 font-bold uppercase tracking-widest text-[10px] md:text-xs">Aucun historique trouvé</p>
          </div>
        )}
      </div>

      {selectedBookingReceipt && (
        <ReceiptModal 
          sale={selectedBookingReceipt} 
          onClose={() => setSelectedBookingReceipt(null)} 
          settings={settings} 
          type="invoice" 
        />
      )}

      <ConfirmModal
        isOpen={!!bookingToDelete}
        title="Supprimer l'historique de séjour"
        message="🚨 ATTENTION : Êtes-vous sûr de vouloir supprimer cet historique de séjour ?\n\nCette action supprimera également les enregistrements de la comptabilité associés."
        confirmLabel="Supprimer"
        onConfirm={() => bookingToDelete && executeDeleteBooking(bookingToDelete)}
        onClose={() => setBookingToDelete(null)}
      />
    </div>
  );
};
