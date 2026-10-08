from config import get_db
from models import Sale, Expense, Room

def generate_financial_summary():
    """Génère un résumé financier complet des ventes et dépenses approuvées"""
    db = get_db()
    if not db:
        return {
            "total_sales": 0.0,
            "total_expenses": 0.0,
            "net_profit": 0.0,
            "sales_by_category": {},
            "expenses_by_category": {}
        }

    total_sales = 0.0
    sales_by_category = {}
    
    try:
        # Calculer le chiffre d'affaires
        sales_docs = db.collection('sales').stream()
        for doc in sales_docs:
            sale = Sale.from_dict(doc.to_dict(), doc.id)
            total_sales += sale.totalPrice
            
            for item in sale.items:
                cat = item.category or "Non classé"
                sales_by_category[cat] = sales_by_category.get(cat, 0.0) + (item.price * item.quantity)
    except Exception as e:
        print(f"Erreur calcul des ventes : {e}")

    total_expenses = 0.0
    expenses_by_category = {}
    
    try:
        # Calculer les dépenses validées
        expense_docs = db.collection('expenses').where('status', '==', 'Approved').stream()
        for doc in expense_docs:
            expense = Expense.from_dict(doc.to_dict(), doc.id)
            total_expenses += expense.amount
            cat = expense.category or "Autre"
            expenses_by_category[cat] = expenses_by_category.get(cat, 0.0) + expense.amount
    except Exception as e:
        print(f"Erreur calcul des dépenses : {e}")

    return {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "net_profit": total_sales - total_expenses,
        "sales_by_category": sales_by_category,
        "expenses_by_category": expenses_by_category
    }

def get_hotel_occupancy_rate():
    """Calcule le taux d'occupation actuel des chambres"""
    db = get_db()
    if not db:
        return 0.0

    try:
        rooms_docs = db.collection('rooms').stream()
        rooms = [Room.from_dict(doc.to_dict(), doc.id) for doc in rooms_docs]
        
        if not rooms:
            return 0.0
            
        occupied_count = sum(1 for r in rooms if r.status == 'Occupied')
        return (occupied_count / len(rooms)) * 100
    except Exception as e:
        print(f"Erreur calcul d'occupation : {e}")
        return 0.0
