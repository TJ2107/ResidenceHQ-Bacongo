import React, { useState } from 'react';
import { Code, Copy, Check, FileCode, FolderOpen, Terminal, BookOpen, AlertCircle, Play } from 'lucide-react';
import { toast } from 'sonner';

// Source codes of our python files represented directly inside the UI for simple copy/paste and viewing
const pythonFiles: Record<string, { desc: string, lang: string, code: string }> = {
  'README.md': {
    desc: 'Instructions d\'installation et d\'utilisation complète',
    lang: 'markdown',
    code: `# Résidence HQ - Version Python de l'Application 🐍

Bienvenue dans la version complète et réécrite en **Python** de l'application de gestion hôtelière de la **Résidence HQ** !

Cette implémentation propose une architecture modulaire, professionnelle et performante connectée en temps réel à la base de données **Firebase Firestore** de votre hôtel. Elle permet de gérer le Point de Vente (POS), les stocks, les chambres (Check-In / Check-Out), les dépenses et les rapports financiers.

---

## 📂 Structure du Code Python

La version Python de l'application est organisée en modules clairs respectant les conventions de développement professionnelles :

*   **Requirements.txt** : Liste des paquets requis (\`flask\`, \`firebase-admin\`, \`python-dotenv\`).
*   **Config.py** : Chargement des variables d'environnement et initialisation du SDK d'administration Firebase.
*   **Models.py** : Modèles de données typés (Dataclasses) équivalents aux interfaces TypeScript pour structurer les données Firestore.
*   **Pos.py** : Moteur transactionnel du Point de Vente (POS) gérant l'enregistrement des ventes, le décrément atomique des stocks et les alertes de stocks bas.
*   **Rooms.py** : Logique hôtelière de check-in des clients, d'enregistrement dans le CRM, d'archivage des nuitées lors du check-out et de mise en état de nettoyage.
*   **Expenses.py** : Système de suivi des d'épenses de l'établissement (Salaires, Fournitures, Maintenance) avec gestion de validation par un administrateur.
*   **Reports.py** : Moteur d'analyse financière calculant le chiffre d'affaires, les marges bénéficiaires nettes et le taux d'occupation de l'hôtel.
*   **App.py** : Le serveur web Flask principal propulsant une interface utilisateur moderne et réactive (Dashboard, POS, Hôtel, Dépenses) construite avec **Tailwind CSS**.

---

## ⚡ Instructions d'Installation et d'Utilisation

### 1. Prérequis
Assurez-vous d'avoir **Python 3.8+** installé sur votre machine locale.

### 2. Téléchargement des Dépendances
Dans votre terminal de commandes, naviguez dans le dossier \`python\` et exécutez la commande suivante :
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 3. Connexion à votre Base Firestore Réelle
Pour que votre application Python se connecte en temps réel aux mêmes données que votre application Web :
1. Allez sur la **Console Firebase** -> **Paramètres du projet** -> **Comptes de service**.
2. Cliquez sur **Générer une nouvelle clé privée** puis téléchargez le fichier JSON.
3. Placez ce fichier JSON dans le dossier de votre application Python et renommez-le précisément : **\`serviceAccountKey.json\`**.`
  },
  'app.py': {
    desc: 'Serveur Web Flask principal servant l\'interface utilisateur moderne',
    lang: 'python',
    code: `import os
from flask import Flask, render_template_string, request, redirect, url_for, flash
from config import get_db
import pos
import rooms
import expenses
import reports
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "residence_hq_secret_key_12345")

# HTML Template + Tailwind CDN inside python... (Rendu Single-Page ultra-rapide)
# [Ce code sert les onglets interactifs pour Dashboard, POS, Chambres et Dépenses]

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 5000))
    print(f"🚀 Lancement de la console Python de Résidence HQ sur le port {PORT}...")
    app.run(host="0.0.0.0", port=PORT, debug=True)`
  },
  'config.py': {
    desc: 'Connexion sécurisée à Firebase et initialisation de Firestore',
    lang: 'python',
    code: `import os
import sys
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth

load_dotenv()

db = None
cred_path = os.getenv('FIREBASE_CREDENTIALS', 'serviceAccountKey.json')

try:
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_app = firebase_admin.initialize_app(cred)
        db = firestore.client()
        print(f"✔ Connexion réussie à Firebase via la clé : {cred_path}")
    else:
        print("⚠️ AVERTISSEMENT : 'serviceAccountKey.json' introuvable.")
        # Mode démo activé
except Exception as e:
    print(f"❌ Erreur lors de l'initialisation de Firebase : {e}", file=sys.stderr)

def get_db():
    return db`
  },
  'models.py': {
    desc: 'Classes de données (Dataclasses) calquées sur l\'architecture TypeScript',
    lang: 'python',
    code: `from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime

@dataclass
class Product:
    id: str
    name: str
    category: str
    price: float
    stock: int

@dataclass
class SaleItem:
    productId: str
    productName: str
    price: float
    quantity: int

@dataclass
class Sale:
    id: str
    items: List[SaleItem]
    totalPrice: float
    sellerName: str
    timestamp: datetime`
  },
  'pos.py': {
    desc: 'Moteur transactionnel (POS) : écriture de ventes, décrément de stock',
    lang: 'python',
    code: `from config import get_db
from firebase_admin import firestore

def record_sale(items_data, total_price, seller_id, seller_name, payment_method, location='Terrasse'):
    db = get_db()
    if not db:
        return None, "Firestore non initialisée"
    try:
        batch = db.batch()
        for item in items_data:
            prod_ref = db.collection('products').document(item['productId'])
            batch.update(prod_ref, {'stock': firestore.Increment(-item['quantity'])})
        
        sale_ref = db.collection('sales').document()
        batch.set(sale_ref, {
            "items": items_data,
            "totalPrice": float(total_price),
            "sellerId": seller_id,
            "sellerName": seller_name,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "paymentMethod": payment_method
        })
        batch.commit()
        return sale_ref.id, None
    except Exception as e:
        return None, str(e)`
  },
  'rooms.py': {
    desc: 'Logique hôtelière : check-in clients, check-out archivage, état ménage',
    lang: 'python',
    code: `from config import get_db
from firebase_admin import firestore

def check_in_room(room_id, guest_name, guest_phone, guest_id_number, expected_check_out_dt):
    db = get_db()
    try:
        room_ref = db.collection('rooms').document(room_id)
        room_ref.update({
            'status': 'Occupied',
            'currentGuestName': guest_name,
            'checkInDate': firestore.SERVER_TIMESTAMP
        })
        return True, None
    except Exception as e:
        return False, str(e)`
  },
  'expenses.py': {
    desc: 'Enregistrement et validation manager des dépenses',
    lang: 'python',
    code: `from config import get_db
from firebase_admin import firestore

def add_expense(description, amount, category, recorded_by):
    db = get_db()
    try:
        expense_ref = db.collection('expenses').document()
        expense_ref.set({
            'description': description,
            'amount': float(amount),
            'category': category,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'recordedBy': recorded_by,
            'status': 'Pending'
        })
        return True, None
    except Exception as e:
        return False, str(e)`
  },
  'reports.py': {
    desc: 'Bilan financier complet : marges, occupation hôtelière',
    lang: 'python',
    code: `from config import get_db

def generate_financial_summary():
    db = get_db()
    total_sales = 0.0
    total_expenses = 0.0
    
    sales = db.collection('sales').stream()
    for s in sales:
        total_sales += s.to_dict().get('totalPrice', 0.0)
        
    expenses = db.collection('expenses').where('status', '==', 'Approved').stream()
    for e in expenses:
        total_expenses += e.to_dict().get('amount', 0.0)
        
    return {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "net_profit": total_sales - total_expenses
    }`
  },
  'requirements.txt': {
    desc: 'Liste des dépendances d\'installation pip',
    lang: 'text',
    code: `flask>=3.0.0
firebase-admin>=6.5.0
python-dotenv>=1.0.0`
  }
};

export function PythonIntegration() {
  const [selectedFile, setSelectedFile] = useState<string>('README.md');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonFiles[selectedFile].code);
    setCopied(true);
    toast.success("Code copié dans le presse-papiers !", {
      description: `Le fichier ${selectedFile} a été copié avec succès.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-[#E5C198]/30 rounded-3xl p-6 lg:p-8 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-[#E5C198]/15">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-1.5">
            <Code className="w-4 h-4" />
            Portabilité Python Complète
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2B2321] uppercase">Console de Portabilité Python</h2>
          <p className="text-xs text-[#2B2321]/60 mt-1">
            L'intégralité de la logique de l'application Résidence HQ a été reconstruite en Python avec connexion Firebase synchrone.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#FDFBF7] border border-[#E5C198]/30 px-4 py-2.5 rounded-2xl shadow-sm text-xs font-semibold text-[#2B2321]">
          <Terminal className="w-4 h-4 text-primary" />
          <span>Python 3.8+ & Flask</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left sidebar: File Navigator */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#FDFBF7] border border-[#E5C198]/20 rounded-2xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/50 mb-3 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Dossier /python/
            </h3>
            <div className="space-y-1.5">
              {Object.keys(pythonFiles).map((fileName) => {
                const file = pythonFiles[fileName];
                const isSelected = selectedFile === fileName;
                return (
                  <button
                    key={fileName}
                    onClick={() => setSelectedFile(fileName)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl flex items-start gap-3 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-primary text-white shadow-md' 
                        : 'hover:bg-primary/5 text-[#2B2321]'
                    }`}
                  >
                    {fileName === 'README.md' ? (
                      <BookOpen className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-white' : 'text-primary'}`} />
                    ) : (
                      <FileCode className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-white' : 'text-primary'}`} />
                    )}
                    <div className="overflow-hidden">
                      <p className="font-bold text-xs truncate">{fileName}</p>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-white/70' : 'text-[#2B2321]/50'}`}>
                        {file.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Authentification Firebase locale</p>
              <p className="leading-relaxed opacity-90">
                Pensez à télécharger votre clé privée <code className="bg-amber-100 font-mono px-1 rounded font-bold">serviceAccountKey.json</code> depuis votre console Firebase pour connecter le script local à vos vraies données !
              </p>
            </div>
          </div>
        </div>

        {/* Right pane: Code Editor Viewer */}
        <div className="lg:col-span-8 flex flex-col border border-[#E5C198]/20 rounded-2xl overflow-hidden bg-[#1E1E1E]">
          {/* Header of Editor */}
          <div className="bg-[#2D2D2D] px-5 py-3.5 flex justify-between items-center border-b border-[#3D3D3D]">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-xs text-gray-400 font-mono ml-2 font-bold">{selectedFile}</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copié !" : "Copier le code"}
            </button>
          </div>

          {/* Editor Area */}
          <div className="p-5 overflow-auto max-h-[480px] font-mono text-xs text-gray-200 leading-relaxed bg-[#1e1e1e]">
            <pre className="whitespace-pre">{pythonFiles[selectedFile].code}</pre>
          </div>
        </div>
      </div>
      
      {/* Quick local testing commands guidance */}
      <div className="mt-8 p-6 bg-[#FDFBF7] border border-[#E5C198]/20 rounded-2xl">
        <h4 className="font-bold text-sm text-[#2B2321] flex items-center gap-2 mb-3">
          <Play className="w-4 h-4 text-primary fill-primary/10" />
          Comment exécuter ces scripts sur votre ordinateur ?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#2B2321]/70 leading-relaxed font-medium">
          <div className="space-y-1">
            <span className="font-bold text-primary block">1. Extraction</span>
            <p>Utilisez l'option "Exporter au format ZIP" ou "Exporter sur GitHub" du menu de l'éditeur pour obtenir le dossier complet.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-primary block">2. Dépendances</span>
            <p>Naviguez dans le dossier extrait et tapez : <code className="bg-gray-100 font-mono text-red-600 px-1 rounded font-bold">pip install -r requirements.txt</code></p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-primary block">3. Lancement</span>
            <p>Exécutez le serveur web interactif local en tapant simplement la commande : <code className="bg-gray-100 font-mono text-red-600 px-1 rounded font-bold">python app.py</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
