from datetime import datetime
from config import get_db
from models import Product, Sale, SaleItem, SaleItem as ModelSaleItem
from firebase_admin import firestore

def list_products():
    """Récupère la liste de tous les produits en stock"""
    db = get_db()
    if not db:
        return []
    try:
        products_ref = db.collection('products')
        docs = products_ref.stream()
        return [Product.from_dict(doc.to_dict(), doc.id) for doc in docs]
    except Exception as e:
        print(f"Erreur lors de la récupération des produits : {e}")
        return []

def get_low_stock_products(threshold=5):
    """Filtre les produits dont le niveau de stock est inférieur au seuil"""
    products = list_products()
    return [p for p in products if p.stock <= threshold]

def list_sales(limit=50):
    """Récupère la liste des ventes récentes"""
    db = get_db()
    if not db:
        return []
    try:
        sales_ref = db.collection('sales').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
        docs = sales_ref.stream()
        return [Sale.from_dict(doc.to_dict(), doc.id) for doc in docs]
    except Exception as e:
        print(f"Erreur lors de la récupération des ventes : {e}")
        return []

def record_sale(items_data, total_price, seller_id, seller_name, payment_method, location='Bar', room_id=None, table_number=None):
    """
    Enregistre une nouvelle vente et décrémente les stocks correspondants en base.
    
    Format de items_data:
    [
        {"productId": "prod_id_1", "productName": "Jus d'Orange", "category": "Boissons", "price": 1500, "quantity": 2},
        ...
    ]
    """
    db = get_db()
    if not db:
        return None, "Firestore non initialisée"

    try:
        # Initialiser une transaction ou un lot d'écriture pour assurer la cohérence des stocks
        batch = db.batch()
        
        items_list = []
        for item in items_data:
            prod_id = item["productId"]
            qty = int(item["quantity"])
            
            # Récupérer la référence du produit
            prod_ref = db.collection('products').document(prod_id)
            prod_snap = prod_ref.get()
            
            if not prod_snap.exists:
                return None, f"Le produit avec l'ID {prod_id} n'existe pas."
            
            current_stock = int(prod_snap.to_dict().get('stock', 0))
            if current_stock < qty:
                return None, f"Stock insuffisant pour {item['productName']} (Disponible: {current_stock}, Demandé: {qty})"
            
            # Mettre à jour le stock dans le batch
            batch.update(prod_ref, {'stock': current_stock - qty})
            
            # Ajouter à l'item de vente
            items_list.append({
                "productId": prod_id,
                "productName": item["productName"],
                "category": item.get("category", "Boissons"),
                "price": float(item["price"]),
                "quantity": qty
            })
            
        # Créer le document de vente
        sale_ref = db.collection('sales').document()
        sale_payload = {
            "items": items_list,
            "totalPrice": float(total_price),
            "sellerId": seller_id,
            "sellerName": seller_name,
            "paymentMethod": payment_method,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "location": location,
            "roomId": room_id,
            "tableNumber": table_number,
            "kitchenStatus": "Pending" if any(x.get("category") == "Cuisine" for x in items_list) else "Delivered"
        }
        
        batch.set(sale_ref, sale_payload)
        
        # Enregistrer dans le journal d'événements
        log_ref = db.collection('event_logs').document()
        log_payload = {
            "timestamp": firestore.SERVER_TIMESTAMP,
            "userId": seller_id,
            "username": seller_name,
            "action": "Vente POS",
            "details": f"Vente #{sale_ref.id} enregistrée d'un montant de {total_price} FCFA via {payment_method}."
        }
        batch.set(log_ref, log_payload)
        
        # Valider l'écriture atomique
        batch.commit()
        return sale_ref.id, None
        
    except Exception as e:
        print(f"Erreur lors de l'enregistrement de la vente : {e}")
        return None, str(e)
