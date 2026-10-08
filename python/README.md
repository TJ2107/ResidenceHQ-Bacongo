# Résidence HQ - Version Python de l'Application 🐍🏨

Bienvenue dans la version moderne et interactive construite en **Python** pour la gestion de l'établissement hôtelier **Résidence HQ** !

Cette implémentation utilise une interface utilisateur construite avec **Streamlit** et connectée en temps réel à la base de données **Firebase Firestore** de votre hôtel. Elle permet de gérer de manière fluide et sécurisée le Point de Vente (POS), les stocks, les chambres (Check-In / Check-Out), les dépenses et les rapports financiers consolidés.

---

## 📂 Structure du Code Python

La version Python de l'application est organisée de façon modulaire et professionnelle :

*   **`requirements.txt`** : Liste des paquets requis (`streamlit`, `firebase-admin`, `python-dotenv`).
*   **`config.py`** : Chargement des variables d'environnement et initialisation sécurisée du SDK Firebase Admin.
*   **`models.py`** : Modèles de données typés (Dataclasses Python) calqués sur les interfaces TypeScript de l'application Web.
*   **`pos.py`** : Moteur transactionnel du Point de Vente (POS) gérant l'enregistrement des ventes, la décrémentation atomique des stocks et les alertes de stocks bas.
*   **`rooms.py`** : Logique hôtelière complète (Check-In de clients, CRM intégré, calcul des nuitées au Check-Out et statuts de nettoyage).
*   **`expenses.py`** : Suivi des flux de dépenses de l'établissement avec flux de validation ou rejet par l'administrateur.
*   **`reports.py`** : Moteur d'analyse financière calculant le chiffre d'affaires cumulé, les bénéfices nets et le taux d'occupation de l'hôtel.
*   **`app.py`** : Point d'entrée principal propulsant l'interface moderne avec **Streamlit**, enrichie de designs haut de gamme et d'une typographie élégante (*Plus Jakarta Sans*).

---

## ⚡ Instructions d'Installation et d'Utilisation

### 1. Prérequis
Assurez-vous d'avoir **Python 3.8 ou supérieur** installé sur votre machine.

### 2. Installation des Dépendances
Dans votre terminal, accédez au dossier `python` et exécutez la commande d'installation :
```bash
pip install -r requirements.txt
```

### 3. Connexion à votre Base de Données Firestore Réelle
Pour que votre tableau de bord Python se synchronise en temps réel avec vos données d'exploitation réelles :
1. Allez sur la **[Console Firebase](https://console.firebase.google.com/)**.
2. Sélectionnez votre projet **Résidence HQ**.
3. Allez dans **Paramètres du projet** (icône d'engrenage) ➔ **Comptes de service**.
4. Cliquez sur le bouton **Générer une nouvelle clé privée** puis téléchargez le fichier JSON.
5. Placez ce fichier JSON dans le dossier `python` sous le nom exact : **`serviceAccountKey.json`**.

> 💡 **Mode Démo Intelligent :** En l'absence de clé de compte de service, l'application s'initialise automatiquement en **Mode Démo** autonome avec des données simulées. Cela vous permet de tester l'ensemble de l'interface instantanément !

### 4. Lancement de l'Application
Lancez simplement le script d'auto-lancement :
```bash
python app.py
```
L'application lancera automatiquement l'environnement de développement **Streamlit**. Ouvrez votre navigateur internet sur l'adresse locale indiquée (généralement **`http://localhost:8501`**).

---

## 🎨 Fonctionnalités de l'Interface Streamlit

*   **Tableau de Bord Exécutif** : Visionnez vos indicateurs clés de performance (KPI) sous forme de cartes d'analyse modernes, vos courbes de ventes, l'historique récent de la caisse et le taux d'occupation en temps réel.
*   **Point de Vente (POS) Intelligent** : Caisse enregistreuse complète permettant d'ajouter des produits au panier, de filtrer par catégorie et d'effectuer des ventes avec déduction automatique des stocks physiques.
*   **Contrôleur de Réception Hôtelière** : Un gestionnaire de nuitées permettant d'assigner les chambres, de saisir les fiches clients à l'arrivée (Check-In), de facturer lors du départ (Check-Out) et de contrôler les cycles de ménage.
*   **Registre des Dépenses de l'Établissement** : Saisissez et catégorisez les dépenses courantes (Maintenance, Salaires, Stock) avec approbation/rejet instantané par la direction.
