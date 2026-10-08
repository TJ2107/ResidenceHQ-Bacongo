import os
import sys
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth

# Load environment variables
load_dotenv()

# Initialize Firebase Admin SDK
db = None
firebase_app = None

# We look for a serviceAccountKey.json in the local folder or custom path in env
cred_path = os.getenv('FIREBASE_CREDENTIALS', 'serviceAccountKey.json')

try:
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_app = firebase_admin.initialize_app(cred)
        db = firestore.client()
        print(f"✔ Connexion réussie à Firebase via la clé : {cred_path}")
    else:
        # Fallback for demonstration/educational purposes: try initializing with default app context or local credentials
        try:
            firebase_app = firebase_admin.initialize_app()
            db = firestore.client()
            print("✔ Connexion réussie à Firebase (Credentials par défaut)")
        except Exception:
            print("⚠️ AVERTISSEMENT : 'serviceAccountKey.json' introuvable.")
            print("Pour connecter ce script Python à votre Firestore réelle :")
            print("1. Allez dans la Console Firebase -> Paramètres du projet -> Comptes de service.")
            print("2. Cliquez sur 'Générer une nouvelle clé privée' et téléchargez-la.")
            print(f"3. Placez-le dans ce dossier et renommez-le '{cred_path}'.\n")
            
            # Create dummy/mock client if running without connection (only as a fallback to avoid import crashes)
            class MockFirestoreClient:
                def __getattr__(self, name):
                    return lambda *args, **kwargs: self
                def stream(self):
                    return []
                def get(self):
                    class MockDoc:
                        exists = False
                        def to_dict(self): return {}
                    return MockDoc()
            db = MockFirestoreClient()

except Exception as e:
    print(f"❌ Erreur lors de l'initialisation de Firebase : {e}", file=sys.stderr)

def get_db():
    """Retourne le client Firestore actif"""
    return db

def get_auth():
    """Retourne l'instance Auth Firebase"""
    return firebase_auth
