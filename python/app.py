import os
import sys
from datetime import datetime
import subprocess

# Auto-launcher: if run via "python app.py", boot up Streamlit automatically!
if __name__ == "__main__":
    try:
        import streamlit as st
        if not st.runtime.exists():
            print("🚀 Lancement de l'application Résidence HQ via Streamlit...")
            subprocess.run([sys.executable, "-m", "streamlit", "run", __file__])
            sys.exit(0)
    except ImportError:
        print("❌ Streamlit n'est pas installé. Veuillez exécuter: pip install -r requirements.txt")
        sys.exit(1)

# Import our modular logic
from config import get_db
import pos
import rooms
import expenses
import reports

# Configurer la page Streamlit avec un thème élégant et professionnel
st.set_page_config(
    page_title="Résidence HQ - Python Console",
    page_icon="🏨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling via CSS injection to match Résidence HQ brand identity
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    /* Font overrides */
    html, body, [class*="css"], .stApp {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
    }
    
    /* Brand Color Theme */
    :root {
        --primary: #1A8B8C;
        --secondary: #E5C198;
    }
    
    /* Styling Buttons */
    div.stButton > button, div.stFormSubmitButton > button {
        background-color: #1A8B8C !important;
        color: white !important;
        border-radius: 14px !important;
        border: none !important;
        font-weight: 700 !important;
        padding: 0.65rem 1.4rem !important;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        box-shadow: 0 4px 12px rgba(26, 139, 140, 0.15) !important;
        border: 1px solid rgba(26, 139, 140, 0.1) !important;
    }
    div.stButton > button:hover, div.stFormSubmitButton > button:hover {
        background-color: #147273 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 18px rgba(26, 139, 140, 0.25) !important;
    }
    div.stButton > button:active, div.stFormSubmitButton > button:active {
        transform: translateY(0px) !important;
    }
    
    /* Custom inputs styling */
    input, select, textarea, div[data-baseweb="select"] {
        border-radius: 12px !important;
        border: 1px solid rgba(229, 193, 152, 0.3) !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
    }
    
    /* Sidebar premium visual */
    section[data-testid="stSidebar"] {
        background-color: #FDFBF7 !important;
        border-right: 1px solid rgba(229, 193, 152, 0.2) !important;
    }
    
    /* Titles customization */
    h1, h2, h3, h4, h5, h6 {
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-weight: 800 !important;
        color: #2B2321 !important;
        letter-spacing: -0.5px !important;
    }
    
    /* Custom Card Style */
    .hq-card {
        background-color: #FFFFFF;
        border: 1px solid rgba(229, 193, 152, 0.2);
        border-radius: 20px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 10px 30px rgba(43, 35, 33, 0.03);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .hq-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 20px 40px rgba(43, 35, 33, 0.08);
        border-color: rgba(26, 139, 140, 0.25);
    }
</style>
""", unsafe_allow_html=True)

# Helper: Detect if Firebase connection is active and not a mock fallback client
def is_firebase_ready():
    db = get_db()
    if not db or "MockFirestoreClient" in str(type(db)):
        return False
    return True

# Initialize Session State for Mock Mode fallback
if 'mock_initialized' not in st.session_state:
    st.session_state.mock_products = [
        {"id": "p1", "name": "Bière Castel 65cl", "category": "Boissons", "price": 1000.0, "stock": 4},
        {"id": "p2", "name": "Eau Minérale 1.5L", "category": "Boissons", "price": 500.0, "stock": 15},
        {"id": "p3", "name": "Poulet Braisé entier", "category": "Cuisine", "price": 7000.0, "stock": 10},
        {"id": "p4", "name": "Frites de Pomme", "category": "Cuisine", "price": 1500.0, "stock": 3},
        {"id": "p5", "name": "Accès Piscine Enfant", "category": "Piscine", "price": 1500.0, "stock": 100},
    ]
    st.session_state.mock_rooms = [
        {"id": "r1", "number": "101", "type": "Chambre de Luxe", "price": 45000.0, "status": "Available"},
        {"id": "r2", "number": "102", "type": "Chambre Standard", "price": 30000.0, "status": "Cleaning"},
        {"id": "r3", "number": "103", "type": "Résidence 2 chambres", "price": 75000.0, "status": "Occupied", "currentGuestName": "Koffi Mensah"},
    ]
    st.session_state.mock_expenses = [
        {"id": "e1", "description": "Réparation Climatiseur R103", "amount": 25000.0, "category": "Maintenance", "recordedBy": "Cédric", "status": "Pending"},
        {"id": "e2", "description": "Achat pack eau pour bar", "amount": 12000.0, "category": "Stock", "recordedBy": "Marie", "status": "Approved"},
    ]
    st.session_state.mock_sales = [
        {"id": "s1", "items": [{"productId": "p1", "productName": "Bière Castel 65cl", "category": "Boissons", "price": 1000.0, "quantity": 2}], "totalPrice": 2000.0, "sellerName": "Marie", "location": "VIP", "timestamp": datetime.now()},
    ]
    st.session_state.cart = {}
    st.session_state.mock_initialized = True

# --- SIDEBAR & HEADER ---
with st.sidebar:
    st.image("https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=300&q=80", caption="Résidence HQ", use_container_width=True)
    st.title("Résidence HQ 🏨")
    st.write("Console Python d'Administration")
    
    # Check Connection Status
    firebase_active = is_firebase_ready()
    if firebase_active:
        st.success("🟢 Firestore Connectée")
    else:
        st.warning("⚠️ Mode Démo Actif")
        with st.expander("🔌 Connecter Firestore réelle"):
            st.markdown("""
            Pour synchroniser ce script Python avec vos vraies données :
            1. Téléchargez la clé privée JSON depuis la console Firebase (**Paramètres -> Comptes de service**).
            2. Renommez le fichier précisément **`serviceAccountKey.json`**.
            3. Placez-le dans le dossier `python` de votre application locale.
            """)
            
    st.markdown("---")
    
    # Navigation Tabs
    menu = st.radio(
        "Navigation",
        ["📊 Tableau de Bord", "🛒 Point de Vente (POS)", "🛏️ Hôtel & Chambres", "💸 Suivi des Dépenses"]
    )
    
    st.markdown("---")
    st.caption("Fait avec ❤️ pour Résidence HQ • Python Admin")

# --- APP DATA INGESTION ---
if firebase_active:
    # Live Firestore data
    products_list = pos.list_products()
    recent_sales = pos.list_sales(limit=15)
    low_stock = pos.get_low_stock_products(threshold=5)
    hotel_rooms = rooms.list_rooms()
    hotel_expenses = expenses.list_expenses(limit=30)
    financials = reports.generate_financial_summary()
    occupancy_rate = reports.get_hotel_occupancy_rate()
else:
    # Local fallback memory data from session state
    products_list = [pos.Product.from_dict(p, p["id"]) for p in st.session_state.mock_products]
    recent_sales = [pos.Sale.from_dict(s, s["id"]) for s in st.session_state.mock_sales]
    low_stock = [p for p in products_list if p.stock <= 5]
    hotel_rooms = [rooms.Room.from_dict(r, r["id"]) for r in st.session_state.mock_rooms]
    hotel_expenses = [expenses.Expense.from_dict(e, e["id"]) for e in st.session_state.mock_expenses]
    
    # Calculations for fallback
    total_sales = sum(s["totalPrice"] for s in st.session_state.mock_sales)
    total_expenses = sum(e["amount"] for e in st.session_state.mock_expenses if e["status"] == "Approved")
    financials = {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "net_profit": total_sales - total_expenses
    }
    occupied_count = sum(1 for r in st.session_state.mock_rooms if r["status"] == "Occupied")
    occupancy_rate = (occupied_count / len(st.session_state.mock_rooms)) * 100 if st.session_state.mock_rooms else 0.0

# --- VIEW RENDERERS ---

if menu == "📊 Tableau de Bord":
    st.subheader("Bilan d'Activité Hôtelière & POS")
    st.write(f"Données consolidées au {datetime.now().strftime('%d %B %Y - %H:%M')}")
    
    # KPI Metrics Row
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, #1A8B8C 0%, #115F60 100%); color: white; padding: 22px; border-radius: 20px; box-shadow: 0 10px 20px rgba(26,139,140,0.15); margin-bottom: 20px; position: relative; overflow: hidden; min-height: 145px; transition: all 0.3s ease;">
            <div style="position: absolute; right: -10px; bottom: -10px; font-size: 70px; opacity: 0.12; font-weight: bold; pointer-events: none;">💰</div>
            <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.85; color: #E5C198;">Chiffre d'Affaires</p>
            <h3 style="margin: 10px 0 6px 0; font-size: 24px; font-weight: 800; color: #FFFFFF; line-height: 1.2; font-family: 'Plus Jakarta Sans', sans-serif;">{financials['total_sales']:,.0f} <span style="font-size: 13px; font-weight: 500;">FCFA</span></h3>
            <span style="background: rgba(255,255,255,0.18); font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;">{len(recent_sales)} ventes</span>
        </div>
        """, unsafe_allow_html=True)
        
    with col2:
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, #2B2321 0%, #1E1817 100%); color: white; padding: 22px; border-radius: 20px; box-shadow: 0 10px 20px rgba(43,35,33,0.15); margin-bottom: 20px; position: relative; overflow: hidden; min-height: 145px; transition: all 0.3s ease;">
            <div style="position: absolute; right: -10px; bottom: -10px; font-size: 70px; opacity: 0.15; font-weight: bold; pointer-events: none;">💸</div>
            <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.85; color: #E5C198;">Dépenses Validées</p>
            <h3 style="margin: 10px 0 6px 0; font-size: 24px; font-weight: 800; color: #FFFFFF; line-height: 1.2; font-family: 'Plus Jakarta Sans', sans-serif;">{financials['total_expenses']:,.0f} <span style="font-size: 13px; font-weight: 500;">FCFA</span></h3>
            <span style="background: rgba(239, 68, 68, 0.25); color: #FCA5A5; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">Dépenses approuvées</span>
        </div>
        """, unsafe_allow_html=True)
        
    with col3:
        profit = financials['net_profit']
        if profit >= 0:
            profit_gradient = "linear-gradient(135deg, #10B981 0%, #047857 100%)"
            profit_bg = "rgba(255,255,255,0.2)"
            profit_color = "#FFFFFF"
            profit_label = "Bénéficiaire"
            profit_icon = "📈"
        else:
            profit_gradient = "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)"
            profit_bg = "rgba(255,255,255,0.2)"
            profit_color = "#FFFFFF"
            profit_label = "Déficitaire"
            profit_icon = "📉"
            
        st.markdown(f"""
        <div style="background: {profit_gradient}; color: white; padding: 22px; border-radius: 20px; box-shadow: 0 10px 20px rgba(16,185,129,0.15); margin-bottom: 20px; position: relative; overflow: hidden; min-height: 145px; transition: all 0.3s ease;">
            <div style="position: absolute; right: -10px; bottom: -10px; font-size: 70px; opacity: 0.12; font-weight: bold; pointer-events: none;">{profit_icon}</div>
            <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.85; color: #E5C198;">Bénéfice Net Estimé</p>
            <h3 style="margin: 10px 0 6px 0; font-size: 24px; font-weight: 800; color: #FFFFFF; line-height: 1.2; font-family: 'Plus Jakarta Sans', sans-serif;">{profit:,.0f} <span style="font-size: 13px; font-weight: 500;">FCFA</span></h3>
            <span style="background: {profit_bg}; color: {profit_color}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">{profit_label}</span>
        </div>
        """, unsafe_allow_html=True)
        
    with col4:
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, #E5C198 0%, #CFA675 100%); color: #2B2321; padding: 22px; border-radius: 20px; box-shadow: 0 10px 20px rgba(229,193,152,0.25); margin-bottom: 20px; position: relative; overflow: hidden; min-height: 145px; transition: all 0.3s ease;">
            <div style="position: absolute; right: -10px; bottom: -10px; font-size: 70px; opacity: 0.15; font-weight: bold; pointer-events: none;">🏨</div>
            <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.85; color: #1A8B8C;">Taux d'Occupation</p>
            <h3 style="margin: 10px 0 6px 0; font-size: 24px; font-weight: 800; color: #2B2321; line-height: 1.2; font-family: 'Plus Jakarta Sans', sans-serif;">{occupancy_rate:.1f}%</h3>
            <span style="background: rgba(26,139,140,0.15); color: #1A8B8C; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;">Séjour actif</span>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown("---")
    
    # Charts & Lists Row
    chart_col, alert_col = st.columns([2, 1])
    
    with chart_col:
        st.subheader("📈 Répartition du Chiffre d'Affaires")
        
        # Calculate categories for chart
        categories_data = {}
        for sale in recent_sales:
            for item in sale.items:
                cat = item.category or "Boissons"
                categories_data[cat] = categories_data.get(cat, 0.0) + (item.price * item.quantity)
                
        if categories_data:
            st.bar_chart(categories_data)
        else:
            st.info("Aucune donnée disponible pour tracer le graphique.")
            
        # Recent Sales log table
        st.subheader("🛒 Flux des ventes récentes")
        sales_data = []
        for s in recent_sales[:8]:
            sales_data.append({
                "Date": s.timestamp.strftime('%d/%m %H:%M') if s.timestamp else 'N/A',
                "Articles": ", ".join([f"{item.quantity}x {item.productName}" for item in s.items]),
                "Lieu": s.location,
                "Mode": s.paymentMethod,
                "Total (FCFA)": f"{s.totalPrice:,.0f}".replace(",", " ")
            })
        if sales_data:
            st.table(sales_data)
        else:
            st.write("Aucune vente enregistrée.")
            
    with alert_col:
        st.subheader("🚨 Alertes de Stock Bas")
        if low_stock:
            for prod in low_stock:
                st.error(f"**{prod.name}**\n\nStock restant : **{prod.stock}** {prod.category}")
        else:
            st.success("✅ Tous les produits ont un niveau de stock optimal !")
            
        st.markdown("---")
        st.subheader("📊 État des Chambres")
        available = sum(1 for r in hotel_rooms if r.status == 'Available')
        occupied = sum(1 for r in hotel_rooms if r.status == 'Occupied')
        cleaning = sum(1 for r in hotel_rooms if r.status == 'Cleaning')
        
        st.write(f"🟢 **Prêtes / Disponibles :** {available}")
        st.write(f"🔴 **Occupées :** {occupied}")
        st.write(f"🟡 **En cours de ménage :** {cleaning}")

elif menu == "🛒 Point de Vente (POS)":
    st.subheader("Caisse Enregistreuse POS (Point de Vente)")
    
    grid_col, cart_col = st.columns([3, 2])
    
    with grid_col:
        st.write("### Articles en stock")
        # Filters
        cats = list(set([p.category for p in products_list]))
        selected_cat = st.selectbox("Filtrer par catégorie", ["Toutes"] + cats)
        
        # Filter products
        filtered_prods = products_list
        if selected_cat != "Toutes":
            filtered_prods = [p for p in products_list if p.category == selected_cat]
            
        # Render products grid in 2 columns
        prod_cols = st.columns(2)
        for i, prod in enumerate(filtered_prods):
            with prod_cols[i % 2]:
                st.markdown(f"""
                <div class="hq-card" style="position: relative;">
                    <div style="font-size: 10px; font-weight: 700; color: #1A8B8C; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">{prod.category}</div>
                    <h4 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 800; color: #2B2321; line-height: 1.3;">{prod.name}</h4>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(229,193,152,0.12);">
                        <span style="font-weight: 800; color: #1A8B8C; font-size: 16px;">
                            {prod.price:,.0f} <span style="font-size: 11px; font-weight: 600;">F</span>
                        </span>
                        <span style="font-size: 11px; color: #2B2321; opacity: 0.6; font-weight: 600;">Stock: <b style="color: {'#EF4444' if prod.stock <= 2 else '#1A8B8C'}">{prod.stock}</b></span>
                    </div>
                </div>
                """, unsafe_allow_html=True)
                
                # Button inside the grid
                if prod.stock <= 0:
                    st.button(f"Indisponible - {prod.name[:10]}...", key=f"btn_out_{prod.id}", disabled=True)
                else:
                    if st.button(f"➕ Ajouter : {prod.name[:15]}...", key=f"add_{prod.id}"):
                        if prod.id in st.session_state.cart:
                            st.session_state.cart[prod.id]["quantity"] += 1
                        else:
                            st.session_state.cart[prod.id] = {
                                "name": prod.name,
                                "price": prod.price,
                                "category": prod.category,
                                "quantity": 1
                            }
                        st.toast(f"✔ {prod.name} ajouté au panier !")
                        st.rerun()

    with cart_col:
        st.write("### Panier de Commande")
        if st.session_state.cart:
            total_cart_price = 0.0
            
            # List cart items
            for pid, item in list(st.session_state.cart.items()):
                subtotal = item["price"] * item["quantity"]
                total_cart_price += subtotal
                
                # Display line item
                row_c1, row_c2, row_c3 = st.columns([3, 1, 1])
                with row_c1:
                    st.markdown(f"**{item['name']}**\n\n{item['price']:,.0f} F x {item['quantity']}")
                with row_c2:
                    st.markdown(f"**{subtotal:,.0f} F**")
                with row_c3:
                    if st.button("❌", key=f"remove_{pid}"):
                        del st.session_state.cart[pid]
                        st.rerun()
                st.markdown("---")
                
            st.markdown(f"### Total à Payer : **{total_cart_price:,.0f} FCFA**")
            
            # Sales parameters
            pm = st.selectbox("Méthode de Paiement", ["Cash", "Mobile Money", "Card", "Room Charge"])
            loc = st.selectbox("Zone de Service", ["Bar", "Terrasse", "VIP", "Réception"])
            
            # Confirm transaction
            if st.button("💰 Valider l'Enregistrement de la Vente"):
                items_data = []
                for pid, item in st.session_state.cart.items():
                    items_data.append({
                        "productId": pid,
                        "productName": item["name"],
                        "category": item["category"],
                        "price": item["price"],
                        "quantity": item["quantity"]
                    })
                    
                if firebase_active:
                    # Write to live database
                    sale_id, err = pos.record_sale(
                        items_data=items_data,
                        total_price=total_cart_price,
                        seller_id="admin_py",
                        seller_name="Admin Python",
                        payment_method=pm,
                        location=loc
                    )
                    if err:
                        st.error(f"Erreur d'enregistrement : {err}")
                    else:
                        st.success(f"Vente #{sale_id} validée en base !")
                        st.session_state.cart = {}
                        st.rerun()
                else:
                    # Mock memory transaction
                    mock_id = f"s_mock_{len(st.session_state.mock_sales) + 1}"
                    new_sale = {
                        "id": mock_id,
                        "items": items_data,
                        "totalPrice": total_cart_price,
                        "sellerName": "Admin Python (Demo)",
                        "location": loc,
                        "paymentMethod": pm,
                        "timestamp": datetime.now()
                    }
                    # Decrement stocks in session state mock
                    for item in items_data:
                        for m_p in st.session_state.mock_products:
                            if m_p["id"] == item["productId"]:
                                m_p["stock"] = max(0, m_p["stock"] - item["quantity"])
                                
                    st.session_state.mock_sales.append(new_sale)
                    st.session_state.cart = {}
                    st.success(f"Transaction démo #{mock_id} simulée avec succès !")
                    st.rerun()
                    
            if st.button("🧹 Vider le panier"):
                st.session_state.cart = {}
                st.rerun()
        else:
            st.info("Le panier est vide. Veuillez sélectionner des articles de vente.")

elif menu == "🛏️ Hôtel & Chambres":
    st.subheader("Gestion de l'Hôtel & des Nuitées")
    
    # Rooms grid
    cols = st.columns(3)
    for i, room in enumerate(hotel_rooms):
        with cols[i % 3]:
            # Status display text in French
            status_labels = {
                "Available": "Disponible",
                "Occupied": "Occupée",
                "Cleaning": "En Nettoyage"
            }
            status_label = status_labels.get(room.status, room.status)
            
            # Nice subtle background colors for room statuses instead of solid green/red/orange
            bg_badges = {
                "Available": "rgba(16, 185, 129, 0.12)",
                "Occupied": "rgba(239, 68, 68, 0.12)",
                "Cleaning": "rgba(245, 158, 11, 0.12)"
            }
            text_badges = {
                "Available": "#10B981",
                "Occupied": "#EF4444",
                "Cleaning": "#F59E0B"
            }
            badge_bg = bg_badges.get(room.status, "rgba(0,0,0,0.05)")
            badge_text = text_badges.get(room.status, "#555555")
            
            st.markdown(f"""
            <div class="hq-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #2B2321;">Chambre {room.number}</h3>
                        <p style="color: #2B2321; opacity: 0.6; font-size: 11px; margin: 2px 0 0 0; font-weight: 500;">{room.type}</p>
                    </div>
                    <span style="background-color: {badge_bg}; color: {badge_text}; font-size: 10px; font-weight: 700; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ● {status_label}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid rgba(229, 193, 152, 0.15); border-bottom: 1px solid rgba(229, 193, 152, 0.15); margin: 12px 0;">
                    <span style="font-size: 11px; color: #2B2321; opacity: 0.6; font-weight: 500;">Tarif de nuitée :</span>
                    <span style="font-weight: 800; color: #1A8B8C; font-size: 14px;">{room.price:,.0f} F <span style="font-size: 10px; font-weight: 500;">/ nuit</span></span>
                </div>
            """, unsafe_allow_html=True)
            
            # Interactive action forms depending on status
            if room.status == "Available":
                st.markdown("<p style='font-size:12px; color:gray;'><b>Formulaire Check-In client :</b></p>", unsafe_allow_html=True)
                g_name = st.text_input("Nom Client", key=f"g_name_{room.id}", placeholder="M. Koffi Kouadio")
                g_phone = st.text_input("Téléphone", key=f"g_phone_{room.id}", placeholder="+225 0700000000")
                g_id = st.text_input("N° Pièce d'identité", key=f"g_id_{room.id}", placeholder="CNI / Passport")
                
                if st.button("🔑 Enregistrer Check-In", key=f"btn_in_{room.id}"):
                    if not g_name or not g_phone or not g_id:
                        st.error("Tous les champs sont obligatoires pour le Check-In.")
                    else:
                        if firebase_active:
                            success, err = rooms.check_in_room(
                                room_id=room.id,
                                guest_name=g_name,
                                guest_phone=g_phone,
                                guest_id_number=g_id,
                                expected_check_out_dt=datetime.now(),
                                user_id="admin_py",
                                user_name="Admin Python"
                            )
                            if success:
                                st.success(f"Check-In de {g_name} validé !")
                                st.rerun()
                            else:
                                st.error(f"Erreur : {err}")
                        else:
                            # Mock memory checkin
                            for r_m in st.session_state.mock_rooms:
                                if r_m["id"] == room.id:
                                    r_m["status"] = "Occupied"
                                    r_m["currentGuestName"] = g_name
                            st.success(f"Arrivée de M. {g_name} simulée !")
                            st.rerun()
            
            elif room.status == "Occupied":
                st.markdown(f"<p style='font-size:12px;'>Occupant actuel : <b style='color:#1A8B8C;'>{room.currentGuestName}</b></p>", unsafe_allow_html=True)
                if st.button("🚪 Libérer & Facturer (Check-Out)", key=f"btn_out_{room.id}"):
                    if firebase_active:
                        success, err = rooms.check_out_room(
                            room_id=room.id,
                            payment_method="Cash",
                            room_charge=room.price,
                            pos_charges=0.0,
                            total_paid=room.price,
                            user_id="admin_py",
                            user_name="Admin Python"
                        )
                        if success:
                            st.success("Check-Out validé ! La chambre est en nettoyage.")
                            st.rerun()
                        else:
                            st.error(f"Erreur : {err}")
                    else:
                        # Mock check-out
                        for r_m in st.session_state.mock_rooms:
                            if r_m["id"] == room.id:
                                r_m["status"] = "Cleaning"
                                r_m.pop("currentGuestName", None)
                        st.success("Départ validé ! Chambre passée au statut nettoyage.")
                        st.rerun()
                        
            elif room.status == "Cleaning":
                st.info("Chambre en cours de préparation / nettoyage.")
                if st.button("🧹 Marquer Propre & Prête", key=f"btn_clean_{room.id}"):
                    if firebase_active:
                        success, err = rooms.update_room_status(room.id, "Available", "admin_py", "Admin Python")
                        if success:
                            st.success("Chambre à nouveau disponible !")
                            st.rerun()
                        else:
                            st.error(f"Erreur : {err}")
                    else:
                        # Mock clean finished
                        for r_m in st.session_state.mock_rooms:
                            if r_m["id"] == room.id:
                                r_m["status"] = "Available"
                        st.success("La chambre est prête pour de nouveaux séjours !")
                        st.rerun()
            st.markdown("</div>", unsafe_allow_html=True)

elif menu == "💸 Suivi des Dépenses":
    st.subheader("Contrôle du Registre des Dépenses")
    
    col_form, col_list = st.columns([2, 3])
    
    with col_form:
        st.write("### Ajouter une dépense")
        with st.form("new_expense_form"):
            desc = st.text_input("Description", placeholder="Achat de savon pour l'hôtel, carburant générateur...")
            amount = st.number_input("Montant (FCFA)", min_value=0.0, value=0.0, step=1000.0)
            cat = st.selectbox("Catégorie", ["Utilities", "Salaries", "Stock", "Maintenance", "Other"])
            
            submit = st.form_submit_button("Enregistrer la demande")
            
            if submit:
                if not desc or amount <= 0:
                    st.error("Veuillez saisir une description et un montant valide.")
                else:
                    if firebase_active:
                        success, err = expenses.add_expense(desc, amount, cat, "Admin Python")
                        if success:
                            st.success("Dépense enregistrée en attente de validation.")
                            st.rerun()
                        else:
                            st.error(f"Erreur : {err}")
                    else:
                        # Mock expense addition
                        new_exp = {
                            "id": f"e_mock_{len(st.session_state.mock_expenses) + 1}",
                            "description": desc,
                            "amount": amount,
                            "category": cat,
                            "recordedBy": "Admin Python (Demo)",
                            "status": "Pending"
                        }
                        st.session_state.mock_expenses.append(new_exp)
                        st.success("Dépense enregistrée avec succès (Simulé) !")
                        st.rerun()

    with col_list:
        st.write("### Historique & Approbation")
        if hotel_expenses:
            for exp in hotel_expenses:
                # French statuses and styled badges
                exp_status_labels = {
                    "Pending": "En Attente",
                    "Approved": "Approuvée",
                    "Rejected": "Rejetée"
                }
                exp_status_label = exp_status_labels.get(exp.status, exp.status)
                
                exp_badge_bgs = {
                    "Pending": "rgba(245, 158, 11, 0.12)",
                    "Approved": "rgba(16, 185, 129, 0.12)",
                    "Rejected": "rgba(239, 68, 68, 0.12)"
                }
                exp_badge_texts = {
                    "Pending": "#F59E0B",
                    "Approved": "#10B981",
                    "Rejected": "#EF4444"
                }
                
                exp_bg = exp_badge_bgs.get(exp.status, "rgba(0,0,0,0.05)")
                exp_text = exp_badge_texts.get(exp.status, "#555555")
                
                st.markdown(f"""
                <div class="hq-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 800; color: #2B2321;">{exp.description}</h4>
                            <p style="color: #2B2321; opacity: 0.6; font-size: 11px; margin: 0; font-weight: 500;">
                                Catégorie : <span style="font-weight: 700; color: #1A8B8C;">{exp.category}</span> • Enregistré par : <b>{exp.recordedBy}</b>
                            </p>
                        </div>
                        <div style="text-align: right; min-width: 120px;">
                            <h4 style="margin: 0 0 6px 0; color: #DC2626; font-size: 16px; font-weight: 800;">{exp.amount:,.0f} F</h4>
                            <span style="background-color: {exp_bg}; color: {exp_text}; font-size: 9px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                                {exp_status_label}
                            </span>
                        </div>
                    </div>
                """, unsafe_allow_html=True)
                
                # Validation actions for pending expenses
                if exp.status == "Pending":
                    st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
                    btn_col1, btn_col2, _ = st.columns([1, 1, 2])
                    with btn_col1:
                        if st.button("✅ Valider", key=f"app_{exp.id}"):
                            if firebase_active:
                                success, err = expenses.validate_expense(exp.id, "Approved", "Admin Python", "admin_py")
                                if success:
                                    st.success("Dépense approuvée !")
                                    st.rerun()
                                else:
                                    st.error(f"Erreur : {err}")
                            else:
                                # Mock approve
                                for e_m in st.session_state.mock_expenses:
                                    if e_m["id"] == exp.id:
                                        e_m["status"] = "Approved"
                                st.success("Dépense validée (Démo) !")
                                st.rerun()
                    with btn_col2:
                        if st.button("❌ Rejeter", key=f"rej_{exp.id}"):
                            if firebase_active:
                                success, err = expenses.validate_expense(exp.id, "Rejected", "Admin Python", "admin_py")
                                if success:
                                    st.success("Dépense rejetée !")
                                    st.rerun()
                                else:
                                    st.error(f"Erreur : {err}")
                            else:
                                # Mock reject
                                for e_m in st.session_state.mock_expenses:
                                    if e_m["id"] == exp.id:
                                        e_m["status"] = "Rejected"
                                st.success("Dépense rejetée (Démo) !")
                                st.rerun()
                st.markdown("</div>", unsafe_allow_html=True)
        else:
            st.info("Aucune dépense logguée dans le système.")
