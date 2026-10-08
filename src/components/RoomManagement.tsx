import React, { useState, useEffect } from 'react';
import { Room, RoomType, RoomStatus, Guest, Booking, PaymentMethod, Reservation, UserProfile, AppSettings } from '../types';
import { Plus, X, Trash2, Edit2, Check, UserPlus, Search, Receipt, Calendar, Loader2, Star, Award, Percent, Printer, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, OperationType, handleFirestoreError, logEvent } from '../lib/utils';
import { addDoc, collection, updateDoc, setDoc, doc, deleteDoc, Timestamp, query, orderBy, onSnapshot, getDocs, where, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { format, differenceInCalendarDays, isWithinInterval, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

import { RoomCalendar } from './RoomCalendar';
import { Receipt as ReceiptModal } from './Receipt';
import { toast } from 'sonner';

export const RoomManagement = ({ rooms, isAdmin, user, settings }: { rooms: Room[], isAdmin: boolean, user: UserProfile, settings?: AppSettings | null }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingReservation, setIsAddingReservation] = useState(false);
  const [reservationDate, setReservationDate] = useState<Date | null>(null);
  const [reservationRoomId, setReservationRoomId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [checkInRoom, setCheckInRoom] = useState<Room | null>(null);
  const [checkOutRoom, setCheckOutRoom] = useState<Room | null>(null);
  const [checkoutInvoiceData, setCheckoutInvoiceData] = useState<any | null>(null);

  const canEditRoom = isAdmin || user?.role === 'receptionist' || user?.role === 'manager' || user?.role === 'admin';
  const canAddRoom = isAdmin || user?.role === 'receptionist' || user?.role === 'manager' || user?.role === 'admin';
  
  const [guests, setGuests] = useState<Guest[]>([]);
  const [searchGuest, setSearchGuest] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isNewGuest, setIsNewGuest] = useState(false);
  const [newGuestData, setNewGuestData] = useState({ name: '', phone: '', idNumber: '', email: '' });
  const [expectedCheckOut, setExpectedCheckOut] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'));
  const [advancePaid, setAdvancePaid] = useState<string>('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod>('Cash');

  const [formData, setFormData] = useState({ number: '', type: 'Chambre Standard' as RoomType, price: '', status: 'Available' as RoomStatus });
  const [editFormData, setEditFormData] = useState({ number: '', price: '' });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  const [posCharges, setPosCharges] = useState(0);
  const [fetchingCharges, setFetchingCharges] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');

  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);

  // États pour la fidélisation et les réductions
  const [discountAmount, setDiscountAmount] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [guestPoints, setGuestPoints] = useState(0);

  // États pour les avis clients (Reviews)
  const [guestRating, setGuestRating] = useState(0);
  const [guestComment, setGuestComment] = useState('');
  const [reviewCategory, setReviewCategory] = useState<'Room' | 'Service' | 'Food' | 'General'>('Room');
  const [showCheckoutQr, setShowCheckoutQr] = useState(false);

  useEffect(() => {
    if (checkOutRoom && checkOutRoom.currentGuestId) {
      const g = guests.find(g => g.id === checkOutRoom.currentGuestId);
      if (g) {
        setGuestPoints(g.loyaltyPoints || 0);
      } else {
        setGuestPoints(0);
      }
    } else {
      setGuestPoints(0);
      setDiscountAmount(0);
      setRedeemPoints(false);
      setGuestRating(0);
      setGuestComment('');
      setReviewCategory('Room');
    }
  }, [checkOutRoom, guests]);

  // Pre-calculate reservations for today to optimize grid view
  const currentReservationsMap = React.useMemo(() => {
    const map: Record<string, Reservation> = {};
    const today = new Date();
    
    reservations.forEach(res => {
      if (res.status === 'Confirmed' && isWithinInterval(today, { 
        start: startOfDay(res.checkInDate.toDate()), 
        end: endOfDay(res.checkOutDate.toDate()) 
      })) {
        map[res.roomId] = res;
      }
    });
    return map;
  }, [reservations]);

  // Memoize filtered guests for search
  const filteredGuests = React.useMemo(() => {
    if (!searchGuest) return guests.slice(0, 50); // Show first 50 by default
    const search = searchGuest.toLowerCase();
    return guests.filter(g => 
      g.name.toLowerCase().includes(search) || 
      g.phone.includes(search)
    ).slice(0, 50); // Limit results for performance
  }, [guests, searchGuest]);

  useEffect(() => {
    const fetchPosCharges = async () => {
      if (!checkOutRoom || !checkOutRoom.checkInDate) return;
      setFetchingCharges(true);
      try {
        // Fetch POS Sales - query with simple filter on roomId to avoid composite index requirement
        const qSales = query(
          collection(db, 'sales'), 
          where('roomId', '==', checkOutRoom.id)
        );
        const snapSales = await getDocs(qSales);
        const totalSales = snapSales.docs
          .filter(d => {
            const data = d.data();
            return data.paymentMethod === 'Room Charge' && 
                   data.timestamp && 
                   data.timestamp.seconds >= checkOutRoom.checkInDate.seconds;
          })
          .reduce((acc, d) => acc + (d.data().totalPrice || 0), 0);

        setPosCharges(totalSales);
      } catch (error) {
        console.error("Error fetching POS charges:", error);
      } finally {
        setFetchingCharges(false);
      }
    };

    if (checkOutRoom) {
      fetchPosCharges();
    }
  }, [checkOutRoom]);

  useEffect(() => {
    const q = query(collection(db, 'guests'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setGuests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Guest)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'guests'));

    const resQ = query(collection(db, 'reservations'));
    const unsubRes = onSnapshot(resQ, (snap) => {
      setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reservations'));

    return () => {
      unsub();
      unsubRes();
    };
  }, []);

  const handleStatusChange = async (room: Room, newStatus: RoomStatus) => {
    try {
      await updateDoc(doc(db, 'rooms', room.id), { status: newStatus });
      logEvent(user, 'Chambre', `Statut de la chambre #${room.number} changé en ${newStatus} par ${user.username}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'rooms');
    }
  };

  const handleCheckIn = async () => {
    if (!checkInRoom || (!selectedGuest && !isNewGuest)) return;

    try {
      let guestId = selectedGuest?.id;
      let guestName = selectedGuest?.name;

      if (isNewGuest) {
        const guestDoc = await addDoc(collection(db, 'guests'), {
          ...newGuestData,
          totalStays: 1,
          lastStay: serverTimestamp()
        });
        guestId = guestDoc.id;
        guestName = newGuestData.name;
      } else if (selectedGuest) {
        await setDoc(doc(db, 'guests', selectedGuest.id), {
          name: selectedGuest.name,
          phone: selectedGuest.phone || '',
          totalStays: (selectedGuest.totalStays || 0) + 1,
          lastStay: serverTimestamp()
        }, { merge: true });
      }

      const parsedAdvance = parseInt(advancePaid || '0', 10);
      
      await updateDoc(doc(db, 'rooms', checkInRoom.id), {
        status: 'Occupied',
        currentGuestId: guestId,
        currentGuestName: guestName,
        checkInDate: serverTimestamp(),
        expectedCheckOutDate: Timestamp.fromDate(new Date(expectedCheckOut)),
        advancePaid: parsedAdvance > 0 ? parsedAdvance : 0,
        advancePaymentMethod: parsedAdvance > 0 ? advancePaymentMethod : 'Cash'
      });

      if (parsedAdvance > 0) {
        await addDoc(collection(db, 'sales'), {
          totalPrice: parsedAdvance,
          paymentMethod: advancePaymentMethod,
          sellerId: user.id,
          sellerName: user.username,
          sellerRole: user.role,
          location: 'Réception',
          timestamp: serverTimestamp(),
          roomId: checkInRoom.id,
          status: 'Completed',
          items: [{
            productId: 'room_advance',
            productName: `Avance Hébergement Chambre #${checkInRoom.number} (${guestName || 'Client'})`,
            quantity: 1,
            price: parsedAdvance,
            category: 'Hébergement'
          }]
        });
      }

      logEvent(user, 'Check-In', `Check-in effectué pour la chambre #${checkInRoom.number} (Client: ${guestName}) par ${user.username}.${parsedAdvance > 0 ? ` Avance payée: ${parsedAdvance} FCFA.` : ''}`);

      setCheckInRoom(null);
      setSelectedGuest(null);
      setIsNewGuest(false);
      setNewGuestData({ name: '', phone: '', idNumber: '', email: '' });
      setAdvancePaid('');
      setAdvancePaymentMethod('Cash');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'rooms');
    }
  };

  const handleCheckOut = async () => {
    if (!checkOutRoom) return;

    try {
      const checkInDate = checkOutRoom.checkInDate?.toDate() || new Date();
      const checkOutDate = new Date();
      const nights = Math.max(1, differenceInCalendarDays(checkOutDate, checkInDate));
      const roomChargeRaw = nights * checkOutRoom.price;
      const finalRoomCharge = Math.max(0, roomChargeRaw - discountAmount);
      const advancePaid = checkOutRoom.advancePaid || 0;
      const totalCharge = finalRoomCharge + posCharges;
      const totalPaid = Math.max(0, totalCharge - advancePaid);

      // Ensure we have all required fields for isValidBooking
      if (!checkOutRoom.id || !checkOutRoom.number || !checkOutRoom.currentGuestId || !checkOutRoom.currentGuestName || !checkOutRoom.checkInDate) {
        throw new Error("Données de chambre incomplètes pour le check-out.");
      }

      // Create booking record
      const bookingRef = await addDoc(collection(db, 'bookings'), {
        roomId: checkOutRoom.id,
        roomNumber: checkOutRoom.number,
        guestId: checkOutRoom.currentGuestId,
        guestName: checkOutRoom.currentGuestName,
        checkInDate: checkOutRoom.checkInDate,
        checkOutDate: serverTimestamp(),
        totalNights: nights,
        roomCharge: finalRoomCharge,
        posCharges: posCharges,
        totalPaid: totalPaid, // This is the remaining amount paid at checkout
        advancePaid: advancePaid,
        paymentMethod: paymentMethod,
        discount: discountAmount
      });

      // Create Sale Record for accounting
      if (totalPaid > 0) {
        await addDoc(collection(db, 'sales'), {
          totalPrice: totalPaid,
          paymentMethod: paymentMethod,
          sellerId: user.id,
          sellerName: user.username,
          sellerRole: user.role,
          location: 'Réception',
          timestamp: serverTimestamp(),
          roomId: checkOutRoom.id,
          bookingId: bookingRef.id,
          status: 'Completed',
          items: [
            {
              productId: 'room_stay',
              productName: `Séjour Chambre #${checkOutRoom.number} (${checkOutRoom.currentGuestName})`,
              quantity: 1,
              price: totalPaid,
              category: 'Hébergement'
            }
          ]
        });
      }

      // Update Guest's total stays and loyalty points
      if (checkOutRoom.currentGuestId) {
        const guestDocRef = doc(db, 'guests', checkOutRoom.currentGuestId);
        const pointsEarned = Math.floor(totalCharge / 10000); // 1 point per 10 000 FCFA total
        const pointsUsed = redeemPoints ? Math.min(guestPoints, Math.floor(discountAmount / 100)) : 0;
        
        await setDoc(guestDocRef, {
          name: checkOutRoom.currentGuestName || 'Client',
          totalStays: increment(1),
          lastStay: serverTimestamp(),
          loyaltyPoints: increment(pointsEarned - pointsUsed)
        }, { merge: true });
      }

      // Save review if provided
      if (guestRating > 0 || guestComment.trim() !== '') {
        await addDoc(collection(db, 'reviews'), {
          guestId: checkOutRoom.currentGuestId,
          guestName: checkOutRoom.currentGuestName,
          rating: guestRating,
          comment: guestComment,
          category: reviewCategory,
          timestamp: serverTimestamp()
        });
      }

      // Reset Room
      await updateDoc(doc(db, 'rooms', checkOutRoom.id), {
        status: 'Cleaning',
        currentGuestId: null,
        currentGuestName: null,
        checkInDate: null,
        expectedCheckOutDate: null,
        advancePaid: null,
        advancePaymentMethod: null
      });

      logEvent(user, 'Check-Out', `Check-out effectué pour la chambre #${checkOutRoom.number} (Client: ${checkOutRoom.currentGuestName}) par ${user.username}. Restant payé: ${totalPaid.toLocaleString()} FCFA (Avance: ${advancePaid.toLocaleString()} FCFA, Réduction: ${discountAmount.toLocaleString()} FCFA).`);

      const invoiceObj = {
        id: `FAC-${Date.now().toString().slice(-6)}`,
        timestamp: new Date(),
        guestName: checkOutRoom.currentGuestName || 'Client',
        roomId: checkOutRoom.number,
        location: `Chambre #${checkOutRoom.number}`,
        items: [
          {
            productName: `Séjour Chambre #${checkOutRoom.number} (${nights} nuit${nights > 1 ? 's' : ''})`,
            quantity: nights,
            price: checkOutRoom.price
          },
          ...(posCharges > 0 ? [{
            productName: 'Frais Annexes / Conso POS',
            quantity: 1,
            price: posCharges
          }] : []),
          ...(discountAmount > 0 ? [{
            productName: 'Remise / Réduction',
            quantity: 1,
            price: -discountAmount
          }] : []),
          ...(advancePaid > 0 ? [{
            productName: 'Avance déjà payée',
            quantity: 1,
            price: -advancePaid
          }] : [])
        ],
        totalPrice: totalPaid,
        paymentMethod: paymentMethod
      };

      setCheckOutRoom(null);
      setPosCharges(0);
      setDiscountAmount(0);
      setRedeemPoints(false);
      setGuestRating(0);
      setGuestComment('');
      setCheckoutInvoiceData(invoiceObj);
      showSuccess('Check-out effectué avec succès ! Facture générée.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomToDelete));
      setRoomToDelete(null);
      showSuccess('Chambre supprimée avec succès !');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'rooms');
    }
  };

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return;
    try {
      await updateDoc(doc(db, 'reservations', reservationToCancel.id), {
        status: 'Cancelled'
      });
      setReservationToCancel(null);
      showSuccess('Réservation annulée.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'reservations');
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setEditFormData({ number: room.number, price: room.price.toString() });
  };

  const handleSaveEdit = async () => {
    if (!editingRoom) return;
    try {
      await updateDoc(doc(db, 'rooms', editingRoom.id), {
        number: editFormData.number,
        price: Number(editFormData.price)
      });
      setEditingRoom(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'rooms');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddRoom) {
      toast.error("Seuls la réception, le manager et l'administrateur peuvent ajouter une chambre.");
      return;
    }
    try {
      await addDoc(collection(db, 'rooms'), {
        ...formData,
        price: Number(formData.price)
      });
      logEvent(user, 'Chambre', `Chambre #${formData.number} (${formData.type}) créée par ${user.username}.`);
      setIsAdding(false);
      setFormData({ number: '', type: 'Chambre Standard', price: '', status: 'Available' });
      showSuccess('Chambre créée avec succès !');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rooms');
    }
  };

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-8 z-[100] px-6 py-4 bg-accent text-white rounded-2xl shadow-xl shadow-accent/20 font-bold flex items-center gap-3"
          >
            <Check className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Gestion des Chambres</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">Planning d'occupation, check-in, check-out et facturation</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex p-0.5 sm:p-1 bg-white border border-secondary/30 rounded-lg sm:rounded-xl shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "px-2 py-1 sm:px-4 sm:py-2 text-[8px] sm:text-xs font-bold uppercase tracking-widest rounded-md sm:rounded-lg transition-all",
                viewMode === 'grid' ? "bg-primary text-white" : "text-[#2B2321]/60 hover:text-[#2B2321]"
              )}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "px-2 py-1 sm:px-4 sm:py-2 text-[8px] sm:text-xs font-bold uppercase tracking-widest rounded-md sm:rounded-lg transition-all",
                viewMode === 'calendar' ? "bg-primary text-white" : "text-[#2B2321]/60 hover:text-[#2B2321]"
              )}
            >
              Cal
            </button>
          </div>
          {canAddRoom && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white rounded-xl shadow-sm font-bold hover:bg-primary/90 transition-all text-[9px] sm:text-xs"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" /> Ajouter
            </button>
          )}
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-6">
          {rooms.map((room) => {
            const reservationToday = currentReservationsMap[room.id];

            return (
              <div key={room.id} className="p-2 sm:p-6 bg-white border border-secondary/30 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-shadow rounded-xl sm:rounded-3xl relative overflow-hidden flex flex-col justify-between">
                {reservationToday && room.status === 'Available' && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[7px] sm:text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 md:px-3 md:py-1 rounded-bl-md sm:rounded-bl-xl z-10">
                    Réservé
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-start mb-1.5 md:mb-4">
                    <span className="text-xs sm:text-xl font-bold tracking-tight text-[#2B2321]">#{room.number}</span>
                    <div className="flex items-center gap-0.5 sm:gap-2">
                      <span className={cn(
                        "px-1 py-0.5 md:px-3 md:py-1 text-[7.5px] sm:text-[10px] font-bold uppercase border rounded-full shrink-0",
                        room.status === 'Available' ? "bg-accent/10 text-accent border-accent/20" :
                        room.status === 'Occupied' ? "bg-primary/10 text-primary border-primary/20" :
                        "bg-[#FDFBF7] text-[#2B2321]/60 border-secondary/30"
                      )}>
                        {room.status === 'Available' ? 'Dispo' : room.status === 'Occupied' ? 'Occ' : 'Nettoy'}
                      </span>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        {canEditRoom && (
                          <button onClick={() => handleEditRoom(room)} className="p-0.5 text-primary hover:bg-primary/10 rounded-full" title="Modifier le prix de la chambre">
                            <Edit2 className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => setRoomToDelete(room.id)} className="p-0.5 text-red-500 hover:bg-red-50 rounded-full">
                            <Trash2 className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-[7.5px] sm:text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-0.5 md:mb-2 truncate">{room.type}</p>
                  <p className="text-[10px] sm:text-xl font-bold mb-1.5 md:mb-6 text-primary">{room.price.toLocaleString()} <span className="text-[7.5px] sm:text-[10px] uppercase tracking-widest opacity-60">FCFA/n</span></p>
                </div>
                
                <div className="grid grid-cols-2 gap-1 sm:gap-3">
                  <button 
                    onClick={() => {
                      if (reservationToday) {
                        setSelectedReservation(reservationToday);
                      } else {
                        setCheckInRoom(room);
                      }
                    }}
                    disabled={room.status !== 'Available'}
                    className={cn(
                      "py-1 sm:py-3 text-white rounded-md sm:rounded-2xl shadow-sm text-[7.5px] sm:text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 transition-colors truncate px-0.5",
                      reservationToday ? "bg-blue-500 hover:bg-blue-600" : "bg-primary hover:bg-primary/90"
                    )}
                  >
                    {reservationToday ? 'In (Rés)' : 'Check-In'}
                  </button>
                  <button 
                    onClick={() => {
                      setCheckOutRoom(room);
                    }}
                    disabled={room.status !== 'Occupied'}
                    className="py-1 sm:py-3 bg-white border border-secondary/50 text-[#2B2321] rounded-md sm:rounded-2xl text-[7.5px] sm:text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 hover:bg-[#FDFBF7] transition-colors truncate px-0.5"
                  >
                    Check-Out
                  </button>
                </div>
                {room.status === 'Cleaning' && (
                  <button 
                    onClick={() => handleStatusChange(room, 'Available')}
                    className="w-full mt-1 py-1 bg-accent/20 text-accent border border-accent/30 rounded-md sm:rounded-xl text-[7.5px] sm:text-[10px] font-bold uppercase tracking-widest hover:bg-accent/30 transition-colors"
                  >
                    Propre
                  </button>
                )}
              </div>
            );
          })}
      </div>
      ) : (
        <RoomCalendar 
          rooms={rooms} 
          reservations={reservations} 
          onAddReservation={(roomId, date) => {
            setReservationRoomId(roomId);
            setReservationDate(date);
            setIsAddingReservation(true);
          }} 
          onViewReservation={(res) => setSelectedReservation(res)}
        />
      )}

      <AnimatePresence>
        {/* Reservation Details / Check-In from Reservation */}
        {selectedReservation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-3xl p-4 sm:p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base sm:text-xl font-bold tracking-tight uppercase text-[#2B2321]">Détails Réservation</h3>
                <button onClick={() => setSelectedReservation(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-secondary/20 space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-primary/60 font-bold uppercase tracking-widest text-[10px]">Client</span>
                    <span className="font-bold text-[#2B2321]">{selectedReservation.guestName}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-primary/60 font-bold uppercase tracking-widest text-[10px]">Chambre</span>
                    <span className="font-bold text-[#2B2321]">#{selectedReservation.roomNumber}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-primary/60 font-bold uppercase tracking-widest text-[10px]">Arrivée</span>
                    <span className="font-bold text-[#2B2321]">{format(selectedReservation.checkInDate.toDate(), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-primary/60 font-bold uppercase tracking-widest text-[10px]">Départ</span>
                    <span className="font-bold text-[#2B2321]">{format(selectedReservation.checkOutDate.toDate(), 'dd/MM/yyyy')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button 
                    onClick={async () => {
                      try {
                        const room = rooms.find(r => r.id === selectedReservation.roomId);
                        if (!room) return;

                        await updateDoc(doc(db, 'rooms', room.id), {
                          status: 'Occupied',
                          currentGuestId: selectedReservation.guestId,
                          currentGuestName: selectedReservation.guestName,
                          checkInDate: serverTimestamp(),
                          expectedCheckOutDate: selectedReservation.checkOutDate
                        });

                        await updateDoc(doc(db, 'reservations', selectedReservation.id), {
                          status: 'CheckedIn'
                        });

                        setSelectedReservation(null);
                        showSuccess('Check-in effectué depuis la réservation !');
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, 'rooms');
                      }
                    }}
                    className="py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-primary/90 transition-all"
                  >
                    Confirmer Check-In
                  </button>
                  <button 
                    onClick={() => {
                      setReservationToCancel(selectedReservation);
                      setSelectedReservation(null);
                    }}
                    className="py-4 bg-white border border-red-200 text-red-500 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-red-50 transition-all"
                  >
                    Annuler Réservation
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Reservation Modal */}
        {isAddingReservation && reservationRoomId && reservationDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-white border border-secondary/30 shadow-2xl rounded-3xl p-4 sm:p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base sm:text-xl font-bold tracking-tight uppercase text-[#2B2321]">Nouvelle Réservation</h3>
                  <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">
                    Chambre #{rooms.find(r => r.id === reservationRoomId)?.number} - {format(reservationDate, 'dd/MM/yyyy')}
                  </p>
                </div>
                <button onClick={() => setIsAddingReservation(false)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4 p-1 bg-[#FDFBF7] rounded-2xl border border-secondary/20">
                  <button 
                    onClick={() => setIsNewGuest(false)}
                    className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", !isNewGuest ? "bg-white shadow-sm text-primary" : "text-[#2B2321]/40")}
                  >
                    Client Existant
                  </button>
                  <button 
                    onClick={() => setIsNewGuest(true)}
                    className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", isNewGuest ? "bg-white shadow-sm text-primary" : "text-[#2B2321]/40")}
                  >
                    Nouveau Client
                  </button>
                </div>

                {isNewGuest ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Nom Complet</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.name}
                          onChange={e => setNewGuestData({...newGuestData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Téléphone</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.phone}
                          onChange={e => setNewGuestData({...newGuestData, phone: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">N° Pièce d'identité</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.idNumber}
                          onChange={e => setNewGuestData({...newGuestData, idNumber: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Email (Optionnel)</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.email}
                          onChange={e => setNewGuestData({...newGuestData, email: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                      <input 
                        placeholder="Rechercher un client..."
                        className="w-full pl-10 pr-4 py-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                        value={searchGuest}
                        onChange={e => setSearchGuest(e.target.value)}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-secondary/20 rounded-xl divide-y divide-secondary/10">
                      {filteredGuests.map(guest => (
                        <button 
                          key={guest.id}
                          onClick={() => setSelectedGuest(guest)}
                          className={cn(
                            "w-full p-3 text-left flex justify-between items-center transition-colors",
                            selectedGuest?.id === guest.id ? "bg-primary/5" : "hover:bg-[#FDFBF7]"
                          )}
                        >
                          <div>
                            <p className="font-bold text-sm text-[#2B2321]">{guest.name}</p>
                            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">{guest.phone}</p>
                          </div>
                          {selectedGuest?.id === guest.id && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Date de départ prévue</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                    <input 
                      type="date"
                      className="w-full pl-10 pr-4 py-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                      value={expectedCheckOut}
                      onChange={e => setExpectedCheckOut(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  onClick={async () => {
                    if (!reservationRoomId || (!selectedGuest && !isNewGuest)) return;
                    try {
                      let guestId = selectedGuest?.id;
                      let guestName = selectedGuest?.name;
                      let guestPhone = selectedGuest?.phone;

                      if (isNewGuest) {
                        const guestDoc = await addDoc(collection(db, 'guests'), {
                          ...newGuestData,
                          totalStays: 0,
                          lastStay: serverTimestamp()
                        });
                        guestId = guestDoc.id;
                        guestName = newGuestData.name;
                        guestPhone = newGuestData.phone;
                      }

                      const room = rooms.find(r => r.id === reservationRoomId);

                      await addDoc(collection(db, 'reservations'), {
                        roomId: reservationRoomId,
                        roomNumber: room?.number,
                        guestId,
                        guestName,
                        guestPhone,
                        checkInDate: Timestamp.fromDate(reservationDate),
                        checkOutDate: Timestamp.fromDate(new Date(expectedCheckOut)),
                        status: 'Confirmed',
                        createdAt: serverTimestamp()
                      });

                      setIsAddingReservation(false);
                      setReservationRoomId(null);
                      setReservationDate(null);
                      setSelectedGuest(null);
                      setIsNewGuest(false);
                      setNewGuestData({ name: '', phone: '', idNumber: '', email: '' });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, 'reservations');
                    }
                  }}
                  disabled={(!selectedGuest && !isNewGuest) || (isNewGuest && (!newGuestData.name || !newGuestData.phone))}
                  className="w-full py-4 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 font-bold uppercase tracking-widest text-sm hover:bg-blue-600 transition-all disabled:opacity-30"
                >
                  Confirmer la Réservation
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Check-In Modal */}
        {checkInRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-white border border-secondary/30 shadow-2xl rounded-3xl p-4 sm:p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base sm:text-xl font-bold tracking-tight uppercase text-[#2B2321]">Check-In Chambre #{checkInRoom.number}</h3>
                  <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">{checkInRoom.type} - {checkInRoom.price.toLocaleString()} FCFA/nuit</p>
                </div>
                <button onClick={() => setCheckInRoom(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4 p-1 bg-[#FDFBF7] rounded-2xl border border-secondary/20">
                  <button 
                    onClick={() => setIsNewGuest(false)}
                    className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", !isNewGuest ? "bg-white shadow-sm text-primary" : "text-[#2B2321]/40")}
                  >
                    Client Existant
                  </button>
                  <button 
                    onClick={() => setIsNewGuest(true)}
                    className={cn("flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", isNewGuest ? "bg-white shadow-sm text-primary" : "text-[#2B2321]/40")}
                  >
                    Nouveau Client
                  </button>
                </div>

                {isNewGuest ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Nom Complet</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.name}
                          onChange={e => setNewGuestData({...newGuestData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Téléphone</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.phone}
                          onChange={e => setNewGuestData({...newGuestData, phone: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">N° Pièce d'identité</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.idNumber}
                          onChange={e => setNewGuestData({...newGuestData, idNumber: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Email (Optionnel)</label>
                        <input 
                          className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                          value={newGuestData.email}
                          onChange={e => setNewGuestData({...newGuestData, email: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                      <input 
                        placeholder="Rechercher un client..."
                        className="w-full pl-10 pr-4 py-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                        value={searchGuest}
                        onChange={e => setSearchGuest(e.target.value)}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-secondary/20 rounded-xl divide-y divide-secondary/10">
                      {filteredGuests.map(guest => (
                        <button 
                          key={guest.id}
                          onClick={() => setSelectedGuest(guest)}
                          className={cn(
                            "w-full p-3 text-left flex justify-between items-center transition-colors",
                            selectedGuest?.id === guest.id ? "bg-primary/5" : "hover:bg-[#FDFBF7]"
                          )}
                        >
                          <div>
                            <p className="font-bold text-sm text-[#2B2321]">{guest.name}</p>
                            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest">{guest.phone}</p>
                          </div>
                          {selectedGuest?.id === guest.id && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Date de départ prévue</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                    <input 
                      type="date"
                      className="w-full pl-10 pr-4 py-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                      value={expectedCheckOut}
                      onChange={e => setExpectedCheckOut(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-secondary/20 pt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Avance Payée (FCFA)</label>
                    <input 
                      type="number"
                      placeholder="0"
                      className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                      value={advancePaid}
                      onChange={e => setAdvancePaid(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Mode de paiement (Avance)</label>
                    <select
                      className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold focus:border-primary"
                      value={advancePaymentMethod}
                      onChange={e => setAdvancePaymentMethod(e.target.value as PaymentMethod)}
                    >
                      <option value="Cash">Espèces</option>
                      <option value="Card">Carte Bancaire</option>
                      <option value="Mobile Money">Mobile Money</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleCheckIn}
                  disabled={(!selectedGuest && !isNewGuest) || (isNewGuest && (!newGuestData.name || !newGuestData.phone))}
                  className="w-full py-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-sm hover:bg-primary/90 transition-all disabled:opacity-30"
                >
                  Confirmer le Check-In
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Check-Out Modal */}
        {checkOutRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black tracking-tight uppercase text-[#2B2321]">Check-Out #{checkOutRoom.number}</h3>
                <button onClick={() => setCheckOutRoom(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenu principal de checkout */}
              {(() => {
                const checkInDate = checkOutRoom.checkInDate?.toDate() || new Date();
                const nights = Math.max(1, differenceInCalendarDays(new Date(), checkInDate));
                const roomChargeRaw = nights * checkOutRoom.price;
                const finalRoomCharge = Math.max(0, roomChargeRaw - discountAmount);
                const advancePaid = checkOutRoom.advancePaid || 0;
                const grandTotal = Math.max(0, finalRoomCharge + posCharges - advancePaid);

                return (
                  <div className="space-y-6">
                    <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-secondary/20 space-y-3">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px]">Client</span>
                        <span className="font-bold text-[#2B2321]">{checkOutRoom.currentGuestName}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px]">Arrivée</span>
                        <span className="font-bold text-[#2B2321]">{checkOutRoom.checkInDate ? format(checkOutRoom.checkInDate.toDate(), 'dd/MM/yyyy HH:mm') : '-'}</span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px]">Nuits</span>
                        <span className="font-bold text-[#2B2321]">{nights}</span>
                      </div>
                      <div className="h-px bg-secondary/15 my-2" />
                      
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px]">Chambre</span>
                        <span className="font-bold text-[#2B2321]">{roomChargeRaw.toLocaleString()} FCFA</span>
                      </div>
                      {advancePaid > 0 && (
                        <div className="flex justify-between text-xs sm:text-sm text-green-700 font-bold">
                          <span className="uppercase tracking-widest text-[9px] flex items-center gap-1">Avance Payée</span>
                          <span>-{advancePaid.toLocaleString()} FCFA</span>
                        </div>
                      )}
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-xs sm:text-sm text-green-600 font-bold">
                          <span className="uppercase tracking-widest text-[9px] flex items-center gap-1"><Percent className="w-3 h-3" /> Réduction</span>
                          <span>-{discountAmount.toLocaleString()} FCFA</span>
                        </div>
                      )}

                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-primary/60 font-bold uppercase tracking-widest text-[9px]">Extras (POS)</span>
                        <div className="flex items-center gap-2">
                          {fetchingCharges ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          ) : (
                            <input 
                              type="number"
                              className="w-24 p-1 border border-secondary/30 rounded-lg text-right font-bold text-xs"
                              value={posCharges}
                              onChange={e => setPosCharges(Number(e.target.value))}
                            />
                          )}
                          <span className="font-bold text-[#2B2321]">FCFA</span>
                        </div>
                      </div>
                      <div className="h-px bg-secondary/15 my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-primary font-bold uppercase tracking-widest text-xs">Total à payer</span>
                        <span className="text-xl font-black text-primary">{grandTotal.toLocaleString()} FCFA</span>
                      </div>
                    </div>

                    {/* Section fidélité et remises */}
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                        <Award className="w-4 h-4 text-accent animate-pulse" /> Fidélité & Réductions
                      </p>
                      
                      {guestPoints > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-[#2B2321]/85">
                            Le client possède <strong className="text-accent">{guestPoints}</strong> points de fidélité.
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-dashed border-secondary/20">
                            <input 
                              type="checkbox"
                              checked={redeemPoints}
                              onChange={e => {
                                const checked = e.target.checked;
                                setRedeemPoints(checked);
                                if (checked) {
                                  const pointsUsed = Math.min(guestPoints, Math.floor(roomChargeRaw / 100));
                                  setDiscountAmount(pointsUsed * 100);
                                } else {
                                  setDiscountAmount(0);
                                }
                              }}
                              className="accent-primary w-4 h-4"
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Utiliser les points (1 pt = 100 FCFA)</span>
                          </label>
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#2B2321]/50 italic">Ce client n'a pas encore accumulé de points.</p>
                      )}

                      {!redeemPoints && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Remise Manuelle (FCFA)</label>
                          <input 
                            type="number"
                            placeholder="Ex: 5000"
                            className="w-full p-2.5 border border-secondary/30 rounded-xl outline-none text-xs font-bold"
                            value={discountAmount || ''}
                            onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Section avis client */}
                    <div className="space-y-3 border-t border-secondary/15 pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Avis de Satisfaction Client
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowCheckoutQr(true)}
                          className="px-2.5 py-1 bg-[#1A8B8C]/10 hover:bg-[#1A8B8C]/20 text-[#1A8B8C] rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer border border-[#1A8B8C]/20"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>Code QR Client</span>
                        </button>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Évaluation :</span>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setGuestRating(star)}
                              className="transition-transform active:scale-90"
                            >
                              <Star className={cn(
                                "w-6 h-6 transition-colors",
                                star <= guestRating ? "text-amber-400 fill-amber-400" : "text-secondary/25"
                              )} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {guestRating > 0 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Catégorie de l'avis</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[8px] font-bold tracking-wider uppercase">
                            {(['Room', 'Service', 'Food', 'General'] as const).map(cat => {
                              const labels: Record<string, string> = { Room: 'Chambre', Service: 'Service', Food: 'Cuisine', General: 'Général' };
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setReviewCategory(cat)}
                                  className={cn(
                                    "p-1.5 rounded-lg border",
                                    reviewCategory === cat ? "bg-primary text-white border-primary" : "bg-white text-[#2B2321]/60 border-secondary/25 hover:border-primary/50"
                                  )}
                                >
                                  {labels[cat]}
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Commentaire du client</label>
                            <textarea 
                              placeholder="Remarques, suggestions d'amélioration..."
                              className="w-full p-2.5 border border-secondary/30 rounded-xl outline-none text-xs font-medium h-16 resize-none focus:bg-[#FDFBF7] focus:border-primary transition-all"
                              value={guestComment}
                              onChange={e => setGuestComment(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 border-t border-secondary/15 pt-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Mode de paiement</label>
                      <select 
                        className="w-full p-3 border border-secondary/30 rounded-xl outline-none font-bold text-xs uppercase"
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      >
                        <option value="Cash">Espèces</option>
                        <option value="Card">Carte Bancaire</option>
                        <option value="Mobile Money">Mobile Money</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          const invoiceObj = {
                            id: `PREV-${Date.now().toString().slice(-6)}`,
                            timestamp: new Date(),
                            guestName: checkOutRoom.currentGuestName || 'Client',
                            roomId: checkOutRoom.number,
                            location: `Chambre #${checkOutRoom.number}`,
                            items: [
                              {
                                productName: `Séjour Chambre #${checkOutRoom.number} (${nights} nuit${nights > 1 ? 's' : ''})`,
                                quantity: nights,
                                price: checkOutRoom.price
                              },
                              ...(posCharges > 0 ? [{
                                productName: 'Frais Annexes / Conso POS',
                                quantity: 1,
                                price: posCharges
                              }] : []),
                              ...(discountAmount > 0 ? [{
                                productName: 'Remise / Réduction',
                                quantity: 1,
                                price: -discountAmount
                              }] : []),
                              ...(advancePaid > 0 ? [{
                                productName: 'Avance déjà payée',
                                quantity: 1,
                                price: -advancePaid
                              }] : [])
                            ],
                            totalPrice: grandTotal,
                            paymentMethod: paymentMethod
                          };
                          setCheckoutInvoiceData(invoiceObj);
                        }}
                        className="py-3 px-4 bg-secondary/15 hover:bg-secondary/25 text-[#2B2321] rounded-2xl font-bold uppercase tracking-widest text-[10px] sm:text-xs transition-all flex items-center justify-center gap-1.5"
                        title="Voir / Imprimer l'aperçu de la facture"
                      >
                        <Printer className="w-4 h-4" /> Aperçu Facture
                      </button>

                      <button 
                        type="button"
                        onClick={handleCheckOut}
                        className="flex-1 py-3.5 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                      >
                        <Receipt className="w-4 h-4" /> Finaliser & Imprimer
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}

        {/* Original Modals */}
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl shadow-primary/20 rounded-3xl p-4 sm:p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-base sm:text-xl font-bold tracking-tight uppercase text-[#2B2321]">Nouvelle Chambre</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Numéro de chambre</label>
                  <input 
                    placeholder="Ex: 101" 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                    value={formData.number}
                    onChange={e => setFormData({...formData, number: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Type de chambre</label>
                  <select 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321] appearance-none"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as RoomType})}
                  >
                    <option value="Résidence 3 chambres">Résidence 3 chambres</option>
                    <option value="Résidence 2 chambres">Résidence 2 chambres</option>
                    <option value="Appartement 1 ch. + salon">Appartement 1 ch. + salon</option>
                    <option value="Chambre de Luxe">Chambre de Luxe</option>
                    <option value="Chambre Standard">Chambre Standard</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Prix par nuit (FCFA)</label>
                  <input 
                    type="number" 
                    placeholder="Ex: 25000" 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                    required
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-sm hover:bg-primary/90 transition-all">Créer la chambre</button>
              </form>
            </motion.div>
          </div>
        )}
        {editingRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-secondary/30 shadow-2xl shadow-primary/20 rounded-3xl p-4 sm:p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-base sm:text-xl font-bold tracking-tight uppercase text-[#2B2321]">Modifier Chambre #{editingRoom.number}</h3>
                <button onClick={() => setEditingRoom(null)} className="p-2 hover:bg-[#FDFBF7] text-primary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Numéro de chambre</label>
                  <input 
                    className={cn(
                      "w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]",
                      !isAdmin && "bg-[#2B2321]/5 text-[#2B2321]/60 cursor-not-allowed opacity-80"
                    )}
                    value={editFormData.number}
                    onChange={e => setEditFormData({...editFormData, number: e.target.value})}
                    disabled={!isAdmin}
                  />
                  {!isAdmin && (
                    <p className="text-[9px] text-[#2B2321]/50 font-medium tracking-tight">Le numéro de chambre ne peut être modifié que par l'administrateur.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Prix par nuit (FCFA)</label>
                  <input 
                    type="number" 
                    className="w-full p-4 border border-secondary/30 rounded-2xl outline-none font-bold tracking-tight focus:bg-[#FDFBF7] focus:border-primary transition-all text-[#2B2321]"
                    value={editFormData.price}
                    onChange={e => setEditFormData({...editFormData, price: e.target.value})}
                  />
                </div>
                <button onClick={handleSaveEdit} className="w-full py-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Sauvegarder
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Cancel Reservation Confirmation Modal */}
        {reservationToCancel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white border border-secondary/30 shadow-2xl rounded-3xl p-4 sm:p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <X className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#2B2321] mb-2">Annuler la réservation ?</h3>
              <p className="text-sm text-[#2B2321]/60 mb-8">Voulez-vous vraiment annuler la réservation de {reservationToCancel.guestName} pour la chambre #{reservationToCancel.roomNumber} ?</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setReservationToCancel(null)}
                  className="flex-1 py-3 bg-[#FDFBF7] text-[#2B2321] font-bold rounded-xl hover:bg-secondary/10 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleCancelReservation}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {roomToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white border border-secondary/30 shadow-2xl rounded-3xl p-4 sm:p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#2B2321] mb-2">Supprimer la chambre ?</h3>
              <p className="text-sm text-[#2B2321]/60 mb-8">Cette action est irréversible. Toutes les données liées à cette chambre seront perdues.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setRoomToDelete(null)}
                  className="flex-1 py-3 bg-[#FDFBF7] text-[#2B2321] font-bold rounded-xl hover:bg-secondary/10 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleDeleteRoom}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Invoice / Receipt Modal */}
        {checkoutInvoiceData && (
          <ReceiptModal 
            sale={checkoutInvoiceData} 
            onClose={() => setCheckoutInvoiceData(null)} 
            settings={settings} 
            type="invoice" 
          />
        )}
      </AnimatePresence>
      {/* CHECKOUT QR CODE MODAL */}
      <AnimatePresence>
        {showCheckoutQr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2321]/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl border border-secondary/30 shadow-2xl p-6 text-center space-y-4 relative"
            >
              <button
                type="button"
                onClick={() => setShowCheckoutQr(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1 pt-2">
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Évaluation Chambre #{checkOutRoom?.number}
                </span>
                <h3 className="font-serif font-bold text-lg text-[#2B2321] italic">
                  Flashez pour Évaluer
                </h3>
                <p className="text-xs text-[#2B2321]/60">
                  Présentez ce QR Code au client pour lui permettre d'évaluer son séjour en 30 secondes.
                </p>
              </div>

              <div className="p-4 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-2xl inline-block shadow-inner">
                <QRCodeSVG
                  value={`${window.location.origin}?mode=client&tab=voc`}
                  size={180}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#2B2321"
                  includeMargin={true}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowCheckoutQr(false)}
                className="w-full py-2.5 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
              >
                Fermer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
