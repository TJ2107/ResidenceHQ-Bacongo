from datetime import datetime
from config import get_db
from models import Room, Hall, Booking, Guest
from firebase_admin import firestore

def list_rooms():
    """Récupère l'état de toutes les chambres"""
    db = get_db()
    if not db:
        return []
    try:
        rooms_ref = db.collection('rooms')
        docs = rooms_ref.stream()
        return [Room.from_dict(doc.to_dict(), doc.id) for doc in docs]
    except Exception as e:
        print(f"Erreur lors de la récupération des chambres : {e}")
        return []

def list_halls():
    """Récupère l'état de toutes les salles"""
    db = get_db()
    if not db:
        return []
    try:
        halls_ref = db.collection('halls')
        docs = halls_ref.stream()
        return [Hall.from_dict(doc.to_dict(), doc.id) for doc in docs]
    except Exception as e:
        print(f"Erreur lors de la récupération des salles : {e}")
        return []

def list_bookings(limit=50):
    """Récupère l'historique de réservation"""
    db = get_db()
    if not db:
        return []
    try:
        bookings_ref = db.collection('bookings').order_by('checkInDate', direction=firestore.Query.DESCENDING).limit(limit)
        docs = bookings_ref.stream()
        return [Booking.from_dict(doc.to_dict(), doc.id) for doc in docs]
    except Exception as e:
        print(f"Erreur lors de la récupération de l'historique : {e}")
        return []

def check_in_room(room_id, guest_name, guest_phone, guest_id_number, expected_check_out_dt, user_id, user_name):
    """Enregistre l'arrivée d'un client dans une chambre"""
    db = get_db()
    if not db:
        return False, "Firestore non initialisée"

    try:
        room_ref = db.collection('rooms').document(room_id)
        room_snap = room_ref.get()
        if not room_snap.exists:
            return False, "Chambre introuvable"
        
        room_data = room_snap.to_dict()
        if room_data.get('status') != 'Available':
            return False, f"La chambre {room_data.get('number')} n'est pas disponible actuellement (Statut: {room_data.get('status')})."
        
        # Enregistrer ou mettre à jour le profil Client (CRM)
        guest_ref = db.collection('guests').document()
        # On recherche d'abord si le client existe déjà par son numéro de téléphone ou sa pièce d'identité
        existing_guests = db.collection('guests').where('idNumber', '==', guest_id_number).limit(1).get()
        
        if existing_guests:
            guest_doc = existing_guests[0]
            guest_id = guest_doc.id
            total_stays = guest_doc.to_dict().get('totalStays', 0) + 1
            db.collection('guests').document(guest_id).update({
                'totalStays': total_stays,
                'lastStay': firestore.SERVER_TIMESTAMP,
                'phone': guest_phone,
                'name': guest_name
            })
        else:
            guest_id = guest_ref.id
            db.collection('guests').document(guest_id).set({
                'name': guest_name,
                'phone': guest_phone,
                'idNumber': guest_id_number,
                'totalStays': 1,
                'lastStay': firestore.SERVER_TIMESTAMP
            })

        # Mettre à jour l'état de la chambre
        room_ref.update({
            'status': 'Occupied',
            'currentGuestId': guest_id,
            'currentGuestName': guest_name,
            'checkInDate': firestore.SERVER_TIMESTAMP,
            'expectedCheckOutDate': expected_check_out_dt
        })

        # Créer le log système
        log_ref = db.collection('event_logs').document()
        log_ref.set({
            'timestamp': firestore.SERVER_TIMESTAMP,
            'userId': user_id,
            'username': user_name,
            'action': 'Check-In',
            'details': f"Check-in de {guest_name} dans la chambre {room_data.get('number')}."
        })

        return True, None
    except Exception as e:
        return False, str(e)

def check_out_room(room_id, payment_method, room_charge, pos_charges, total_paid, user_id, user_name):
    """Enregistre le départ d'un client de sa chambre"""
    db = get_db()
    if not db:
        return False, "Firestore non initialisée"

    try:
        room_ref = db.collection('rooms').document(room_id)
        room_snap = room_ref.get()
        if not room_snap.exists:
            return False, "Chambre introuvable"
        
        room_data = room_snap.to_dict()
        if room_data.get('status') != 'Occupied':
            return False, "Cette chambre n'est pas marquée comme occupée."

        guest_id = room_data.get('currentGuestId', '')
        guest_name = room_data.get('currentGuestName', 'Client Inconnu')
        check_in_ts = room_data.get('checkInDate')
        
        # Calculer le nombre de nuits
        dt_in = check_in_ts.datetime if hasattr(check_in_ts, 'datetime') else (check_in_ts or datetime.now())
        dt_out = datetime.now()
        delta = dt_out - dt_in
        nights = max(1, delta.days)

        # Enregistrer la réservation archivée
        booking_ref = db.collection('bookings').document()
        booking_ref.set({
            'roomId': room_id,
            'roomNumber': room_data.get('number', ''),
            'guestId': guest_id,
            'guestName': guest_name,
            'checkInDate': check_in_ts,
            'checkOutDate': firestore.SERVER_TIMESTAMP,
            'totalNights': nights,
            'roomCharge': float(room_charge),
            'posCharges': float(pos_charges),
            'totalPaid': float(total_paid),
            'paymentMethod': payment_method
        })

        # Libérer la chambre et la placer en statut 'Cleaning' (Nettoyage requis)
        room_ref.update({
            'status': 'Cleaning',
            'currentGuestId': firestore.DELETE_FIELD,
            'currentGuestName': firestore.DELETE_FIELD,
            'checkInDate': firestore.DELETE_FIELD,
            'expectedCheckOutDate': firestore.DELETE_FIELD
        })

        # Créer le log système
        log_ref = db.collection('event_logs').document()
        log_ref.set({
            'timestamp': firestore.SERVER_TIMESTAMP,
            'userId': user_id,
            'username': user_name,
            'action': 'Check-Out',
            'details': f"Check-out de {guest_name} de la chambre {room_data.get('number')}. Statut passé à 'Nettoyage'."
        })

        return True, None
    except Exception as e:
        return False, str(e)

def update_room_status(room_id, new_status, user_id, user_name):
    """Met à jour le statut d'une chambre (ex: de 'Cleaning' à 'Available')"""
    db = get_db()
    if not db:
        return False, "Firestore non initialisée"

    try:
        room_ref = db.collection('rooms').document(room_id)
        room_ref.update({'status': new_status})

        log_ref = db.collection('event_logs').document()
        log_ref.set({
            'timestamp': firestore.SERVER_TIMESTAMP,
            'userId': user_id,
            'username': user_name,
            'action': 'Changement Statut Chambre',
            'details': f"Chambre ID {room_id} passée au statut : {new_status}."
        })
        return True, None
    except Exception as e:
        return False, str(e)
