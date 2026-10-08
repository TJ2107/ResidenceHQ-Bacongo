from config import get_db
from models import Expense
from firebase_admin import firestore

def list_expenses(limit=50):
    """Récupère toutes les dépenses enregistrées"""
    db = get_db()
    if not db:
        return []
    try:
        expenses_ref = db.collection('expenses').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
        docs = expenses_ref.stream()
        return [Expense.from_dict(doc.to_dict(), doc.id) for doc in docs]
    except Exception as e:
        print(f"Erreur lors de la récupération des dépenses : {e}")
        return []

def add_expense(description, amount, category, recorded_by, status='Pending'):
    """Enregistre une nouvelle dépense dans le système"""
    db = get_db()
    if not db:
        return False, "Firestore non initialisée"

    try:
        expense_ref = db.collection('expenses').document()
        expense_ref.set({
            'description': description,
            'amount': float(amount),
            'category': category,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'recordedBy': recorded_by,
            'status': status
        })
        return True, None
    except Exception as e:
        return False, str(e)

def validate_expense(expense_id, status, validator_name, validator_id):
    """Approuve ou rejette une dépense (Action manager/admin)"""
    db = get_db()
    if not db:
        return False, "Firestore non initialisée"

    try:
        expense_ref = db.collection('expenses').document(expense_id)
        expense_ref.update({
            'status': status,
            'validatedBy': validator_name,
            'validatedById': validator_id
        })

        # Log de l'événement
        log_ref = db.collection('event_logs').document()
        log_ref.set({
            'timestamp': firestore.SERVER_TIMESTAMP,
            'userId': validator_id,
            'username': validator_name,
            'action': 'Validation Dépense',
            'details': f"Dépense ID {expense_id} mise à jour avec le statut '{status}'."
        })
        return True, None
    except Exception as e:
        return False, str(e)
