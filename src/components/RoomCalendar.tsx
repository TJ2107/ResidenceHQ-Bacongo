import React, { useState } from 'react';
import { Room, Reservation } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, addMonths, subMonths, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

export const RoomCalendar = ({ rooms, reservations, onAddReservation, onViewReservation }: { rooms: Room[], reservations: Reservation[], onAddReservation: (roomId: string, date: Date) => void, onViewReservation: (res: Reservation) => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pre-calculate occupancy map for better performance
  const occupancyMap = React.useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    
    rooms.forEach(room => {
      map[room.id] = {};
      
      // 1. Current occupancy
      if (room.status === 'Occupied' && room.checkInDate && room.expectedCheckOutDate) {
        const checkIn = room.checkInDate.toDate();
        const checkOut = room.expectedCheckOutDate.toDate();
        
        // Only map days in current month view
        daysInMonth.forEach(day => {
          if (isWithinInterval(day, { start: startOfDay(checkIn), end: endOfDay(checkOut) })) {
            map[room.id][day.toISOString()] = { 
              type: 'occupied', 
              guestName: room.currentGuestName, 
              isStart: isSameDay(day, checkIn), 
              isEnd: isSameDay(day, checkOut) 
            };
          }
        });
      }

      // 2. Reservations
      reservations.forEach(res => {
        if (res.roomId !== room.id || res.status === 'Cancelled' || res.status === 'CheckedIn') return;
        
        const checkIn = res.checkInDate.toDate();
        const checkOut = res.checkOutDate.toDate();
        
        daysInMonth.forEach(day => {
          // If already occupied, don't overwrite with reservation (or handle overlap)
          if (map[room.id][day.toISOString()]) return;
          
          if (isWithinInterval(day, { start: startOfDay(checkIn), end: endOfDay(checkOut) })) {
            map[room.id][day.toISOString()] = { 
              type: 'reserved', 
              guestName: res.guestName, 
              isStart: isSameDay(day, checkIn), 
              isEnd: isSameDay(day, checkOut), 
              status: res.status, 
              reservation: res 
            };
          }
        });
      });
    });
    
    return map;
  }, [rooms, reservations, daysInMonth]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getOccupancyForRoomAndDate = (room: Room, date: Date) => {
    return occupancyMap[room.id]?.[date.toISOString()] || null;
  };

  return (
    <div className="bg-white border border-secondary/30 rounded-3xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 border-b border-secondary/20 flex justify-between items-center bg-[#FDFBF7] flex-wrap gap-4">
        <h3 className="text-xl font-bold tracking-tight text-[#2B2321] capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: fr })}
        </h3>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-primary/60">Occupé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-primary/60">Réservé</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 bg-white border border-secondary/30 rounded-xl hover:bg-secondary/10 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#2B2321]" />
            </button>
            <button onClick={nextMonth} className="p-2 bg-white border border-secondary/30 rounded-xl hover:bg-secondary/10 transition-colors">
              <ChevronRight className="w-5 h-5 text-[#2B2321]" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="flex border-b border-secondary/20">
            <div className="w-32 flex-shrink-0 p-4 font-bold text-xs uppercase tracking-widest text-primary/60 border-r border-secondary/20 bg-white sticky left-0 z-10">
              Chambre
            </div>
            <div className="flex flex-1">
              {daysInMonth.map(day => (
                <div key={day.toISOString()} className={cn(
                  "flex-1 min-w-[40px] p-2 text-center border-r border-secondary/10 last:border-r-0",
                  isSameDay(day, new Date()) ? "bg-primary/5" : ""
                )}>
                  <div className="text-[10px] font-bold uppercase text-primary/40">{format(day, 'EEE', { locale: fr })}</div>
                  <div className={cn(
                    "text-sm font-bold mt-1",
                    isSameDay(day, new Date()) ? "text-primary" : "text-[#2B2321]"
                  )}>{format(day, 'd')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="divide-y divide-secondary/10">
            {rooms.map(room => (
              <div key={room.id} className="flex hover:bg-[#FDFBF7]/50 transition-colors group">
                <div className="w-32 flex-shrink-0 p-4 border-r border-secondary/20 bg-white sticky left-0 z-10 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#2B2321]">#{room.number}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary/60">{room.type}</div>
                  </div>
                </div>
                <div className="flex flex-1 relative">
                  {daysInMonth.map(day => {
                    const occupancy = getOccupancyForRoomAndDate(room, day);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <div 
                        key={day.toISOString()} 
                        className={cn(
                          "flex-1 min-w-[40px] border-r border-secondary/10 last:border-r-0 relative group/cell cursor-pointer",
                          isToday ? "bg-primary/5" : ""
                        )}
                        onClick={() => {
                          if (!occupancy) {
                            onAddReservation(room.id, day);
                          } else if (occupancy.type === 'reserved') {
                            onViewReservation(occupancy.reservation);
                          }
                        }}
                      >
                        {!occupancy && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 bg-primary/5 transition-opacity">
                            <Plus className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        {occupancy && (
                          <div className={cn(
                            "absolute inset-y-1 left-0 right-0 z-10 flex items-center px-2 overflow-hidden",
                            occupancy.type === 'occupied' ? "bg-primary text-white" : 
                            occupancy.status === 'Confirmed' ? "bg-blue-500 text-white" : "bg-orange-400 text-white",
                            occupancy.isStart ? "rounded-l-lg ml-1" : "",
                            occupancy.isEnd ? "rounded-r-lg mr-1" : "",
                            !occupancy.isStart && !occupancy.isEnd ? "border-y border-white/20" : ""
                          )}>
                            {occupancy.isStart && (
                              <span className="text-[10px] font-bold truncate">
                                {occupancy.guestName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
