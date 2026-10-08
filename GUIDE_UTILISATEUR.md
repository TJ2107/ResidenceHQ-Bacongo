# 📖 Guide d'Utilisation - Remix Résidence HQ

Bienvenue dans le guide d'utilisation officiel du système de gestion **Remix Résidence HQ**. Ce document fournit un mode d'emploi détaillé pour chaque module, explique les règles de sécurité, le système de rôles et la gestion des données.

---

## 📑 Table des Matières

1. [Vue d'Ensemble & Rôles](#1-vue-densemble--rôles)
2. [Sécurité & Privilèges de Purge (Nouveau)](#2-sécurité--privilèges-de-purge-nouveau)
3. [Gestion de l'Inventaire & des Stocks](#3-gestion-de-linventaire--des-stocks)
4. [Point de Vente (POS) & Clôture de Caisse](#4-point-de-vente-pos--clôture-de-caisse)
5. [Gestion Hôtelière & Fiches Clients](#5-gestion-hôtelière--fiches-clients)
6. [Gouvernance, Maintenance & Cuisine (Badges Temps Réel)](#6-gouvernance-maintenance--cuisine-badges-temps-réel)
7. [Piscine & Billetterie](#7-piscine--billetterie)
8. [Administration & Zone de Danger](#8-administration--zone-de-danger)
9. [F.A.Q & Dépannage](#9-faq--dépannage)

---

## 1. Vue d'Ensemble & Rôles

L'application attribue des permissions adaptées à chaque métier de la résidence pour garantir la fluidité opérationnelle tout en protégeant les données financières et stratégiques.

### 👥 Tableau Récapitulatif des Rôles

| Rôle | Accès aux Ventes & POS | Saisie Dépenses / Fiches | Gestion Utilisateurs | Purge & Vidange de Données |
| :--- | :---: | :---: | :---: | :---: |
| **Administrateur** (`admin`) | ✅ Total | ✅ Total | ✅ Oui | 🔴 **Autorisé (Total)** |
| **Manager** (`manager`) | ✅ Total | ✅ Total | 🟡 Consultation / Restreint | 🔴 **Autorisé (Total)** |
| **Réceptionniste** (`receptionist`) | ✅ Ventes & Séjours | ✅ Clients & Réservations | ❌ Non | 🔒 **Interdit** |
| **Serveur / Barman** (`waiter`) | ✅ POS / Prise de commande | ❌ Non | ❌ Non | 🔒 **Interdit** |
| **Cuisinier** (`chef`) | 🟡 Écran Cuisine uniquement | ❌ Non | ❌ Non | 🔒 **Interdit** |
| **Housekeeping / Gouvernance** | 🟡 Tâches ménage | ❌ Non | ❌ Non | 🔒 **Interdit** |

---

## 2. Sécurité, Confirmations & Privilèges de Purge (Nouveau)

### 🔲 Modales de Confirmation Personnalisées (`ConfirmModal`)
Pour garantir une ergonomie optimale et éviter tout blocage lié aux fenêtres natives du navigateur (`window.confirm`) :
* **Interface sur mesure** : Les demandes de suppression d'articles, de ventes, de séjours, de tickets piscine ou de tâches de maintenance s'affichent dans des fenêtres modales dédiées avec flou d'arrière-plan et avertissements visuels clairs.
* **Compatibilité Mobile & iFrame** : Aucune fenêtre bloquée par le navigateur ou par les paramètres pop-up de l'appareil.

### 🔒 Restriction des Boutons de Vidange ("Vider") & Règles Firestore
Afin d'éviter toute perte de données accidentelle ou non autorisée :
* **Visibilité restreinte** : Les boutons "Vider le stock", "Vider le module Hôtel", "Effacer l'historique des séjours", "Vider la base clients" ou "Effacer toutes les dépenses" sont **masqués** pour les rôles d'exécution (serveur, réceptionniste, cuisinier).
* **Profils Autorisés** : Seuls les comptes ayant le rôle **Manager** ou **Administrateur** peuvent visualiser et déclencher ces opérations.
* **Règles Firestore (`firestore.rules`)** : Sécurité renforcée au niveau serveur pour n'autoriser les requêtes de suppression (`deleteDoc`) qu'aux comptes dûment authentifiés en tant qu'administrateurs ou managers.

### 🔄 Restauration Automatique des Stocks & Nettoyage Lié
* Lors de l'annulation ou de la suppression d'une vente (depuis le POS, les Rapports, le Dashboard ou le module Chicha), le système réincrémente automatiquement le stock des articles vendus sur leur emplacement d'origine (Terrasse, Réception, VIP).
* Les enregistrements dépendants (tickets piscine, fiches de réservation, bons chicha) sont nettoyés de manière synchronisée.

### ⚡ Synchronisation Temps Réel et Cache Local
* Lors de l'exécution d'une vidange de stock ou de module, la suppression s'effectue par lots (batches) directement dans Firebase Firestore.
* Le cache local (`localStorage`) est réinitialisé simultanément pour garantir que les données supprimées ne réapparaissent pas lors du rafraîchissement de la page.
* Grâce aux écouteurs Firestore temps réel (`onSnapshot`), l'affichage de tous les utilisateurs connectés se met à jour instantanément sans nécessiter de déconnexion.

---

## 3. Gestion de l'Inventaire & des Stocks

Accessible via le menu **Stock / Inventaire**.

### 📦 Fonctionnalités Principales :
1. **Ajouter un Produit & Modifier les Quantités** :
   * Les rôles **Réceptionniste** (`receptionist`), **Caissière** (`caissiere`), **Serveur** (`serveur`/`waiter`), **Manager** et **Admin** disposent du bouton **"+ Ajouter un article"** et de l'action **"Modif"** pour ajouter des produits au stock et réajuster les quantités par point de vente (Terrasse, Réception, VIP).
   * Renseigner le nom, la catégorie, le prix de vente et les stocks initiaux par point.
2. **Alertes de Stock Bas** :
   * Les produits dont le stock est inférieur ou égal à leur seuil minimal apparaissent mis en évidence avec un badge d'alerte orange/rouge.
3. **Réapprovisionnement Rapide** :
   * Cliquez sur le bouton d'édition ou de réapprovisionnement pour ajuster la quantité en stock.
4. **Vider tout le Stock** *(Managers & Admins uniquement)* :
   * Bouton rouge disponible en haut à droite pour les managers/admins.
   * Une boîte de dialogue de confirmation sécurisée demande validation avant d'exécuter la suppression complète de l'inventaire.

---

## 4. Point de Vente (POS) & Clôture de Caisse

Le module **POS** permet la saisie rapide des consommations et la clôture comptable de fin de journée.

### 🛒 Prise de Commande & Modes de Paiement
* Sélection des articles par catégorie ou recherche textuelle.
* Modes de règlement supportés :
  * **Espèces**
  * **Carte BTP / Carte Bancaire**
  * **Mobile Money (Wave, Orange Money, Moov, MTN)**
  * **Charge Chambre** (transfert direct de la note sur la facture d'une chambre occupée).
* Impression immédiate du reçu au format ticket thermique **80mm**.

### 📊 Clôture de Caisse Quotidienne
En fin de journée ou de service :
1. Ouvrez l'onglet **Clôture de Caisse**.
2. Récapitulatif automatique :
   * Total des ventes du jour filtré par mode de paiement.
   * Total des sorties de caisse (dépenses du jour).
   * Aperçu des stocks restants et de leur valeur.
3. Saisissez le montant en espèces réellement compté dans le tiroir-caisse.
4. L'application calcule instantanément l'**écart de caisse** (excédent ou manquant).
5. Ajoutez une note d'explication si un écart est constaté, puis validez.
6. **Export & Partage** :
   * Générez le rapport PDF haute définition.
   * Utilisez le bouton **Partager** pour envoyer la synthèse sur WhatsApp ou Telegram.

---

## 5. Gestion Hôtelière & Fiches Clients

### 🏨 Chambres & Salles Événementielles
* **Création de Chambres** : Les utilisateurs avec le rôle **Réceptionniste** (`receptionist`), **Manager** ou **Administrateur** disposent désormais du bouton **"+ Ajouter"** pour créer de nouvelles chambres (Numéro, Type, Prix par nuitée).
* Visualisation de l'état des chambres en temps réel : **Libre** (Vert), **Occupée** (Bleu), **À nettoyer** (Jaune), **Maintenance** (Rouge).
* Procédure de **Check-In** : Attribution d'une chambre, sélection du client, dates de séjour et tarif.
* Procédure de **Check-Out** : Génération de la facture globale (nuitées + consommations restaurant/bar transférées sur la chambre).

### 📇 Fiches Clients CRM Sécurisées
* Gestion des fiches clients avec nom, téléphone, email, pièce d'identité et historique des séjours.
* Les mises à jour s'effectuent en mode `merge` transparent pour garantir qu'aucune information n'est écrasée ou perdue lors des enregistrements.

---

## 6. Gouvernance, Maintenance & Cuisine (Badges Temps Réel)

L'application comporte des badges d'alerte rouges intelligents sur la barre de navigation :

* 🍳 **Cuisine** : Indique le nombre de commandes en attente d'être préparées par le chef. Dès que la commande est validée ou prête, le badge se met à jour en temps réel.
* 🧹 **Ménage / Gouvernance** : Affiche le nombre de chambres nécessitant un nettoyage après un check-out. Une fois marquée "Propre", le badge diminue automatiquement.
* 🔧 **Maintenance** : Compte les tâches de réparation ouvertes ou urgentes.
* 💬 **Messagerie / Chat** : Affiche le nombre de messages non lus destinés à l'utilisateur ou envoyés dans les canaux généraux.

---

## 7. Piscine & Billetterie

Le module **Piscine** permet d'émettre des billets d'accès journaliers pour les résidents et les visiteurs extérieurs :
* **Gestion des Tarifs** : Les Réceptionnistes (`receptionist`), Managers et Administrateurs ont désormais le droit de modifier directement les prix des tickets (Adulte et Enfant) via l'icône de crayon ✏️ dans l'en-tête du module Piscine.
* **Émission de Billets** : Choix du type de billet (Adulte, Enfant, VIP, Résident) et possibilité d'imputer le coût directement sur une chambre occupée.
* **Impression & PDF** : Impression du pass d'accès thermique et export de l'historique des entrées au format PDF.
* Décompte des entrées du jour et suivi des recettes piscine.

---

## 8. Administration & Zone de Danger

Le module **Administration / Utilisateurs** permet aux Administrateurs et Managers de gérer le personnel et la maintenance du système.

### 👤 Gestion du Personnel
* Création de comptes utilisateurs.
* Attribution ou modification des rôles (`admin`, `manager`, `receptionist`, `waiter`, `chef`, `housekeeping`).

### ⚠️ Zone de Danger (Gestion des Données)
*(Accessible uniquement aux Administrateurs et Managers)*

En bas du panneau d'administration se trouve la **Zone de Danger**, regroupant les boutons de réinitialisation sélective :
1. **Effacer Tickets Piscine** : Purge l'historique des accès piscine.
2. **Vider Historique Séjours** : Purge l'historique des réservations et séjours passés.
3. **Vider Module Hôtel** : Réinitialise la liste des chambres et salles.
4. **Effacer Ventes (POS)** : Purge l'historique des ventes et clôtures de caisse.
5. **Vider le Stock** : Purge l'intégralité des articles en stock.
6. **Vider Maintenance & Nettoyage** : Réinitialise les tickets de travaux et de ménage.

> ⚠️ **Avertissement** : Ces actions sont irréversibles. Un message de confirmation s'affiche avant chaque exécution.

---

## 9. F.A.Q & Dépannage

### ❓ J'essaie de vider le stock ou les ventes mais rien ne se passe / le bouton est absent.
👉 **Cause** : Votre compte n'a pas le rôle **Manager** ou **Administrateur**.
👉 **Solution** : Demandez à l'administrateur de l'établissement de mettre à jour votre rôle dans le module **Gestion des Utilisateurs**.

### ❓ Après avoir vidé le stock, est-ce que les anciens produits réapparaissent si je rafraîchis la page ?
👉 **Non**. Le système purge désormais à la fois la base de données Firestore en ligne et le cache local du navigateur (`localStorage`), garantissant un effacement définitif et propre.

### ❓ Comment réimprimer une clôture de caisse passée ?
👉 Dans l'onglet **POS / Clôtures**, vous pouvez consulter l'historique de toutes les clôtures enregistrées, revoir le détail des chiffres et réexporter le rapport PDF à tout moment.

---

*Document maintenu pour Remix Résidence HQ - Version 2.5*
