# 🏨 Résidence HQ

Système complet de gestion d'hôtel, de point de vente (POS), de gestion de stocks et d'accès piscine conçu pour la **Résidence HQ**. Ce projet intègre une interface utilisateur moderne et réactive construite avec React, Tailwind CSS et Framer Motion, propulsée par un backend Firebase Firestore temps réel sécurisé.

---

## 📚 Guides et Documentation

* 📖 **[Guide d'Utilisation Complet (GUIDE_UTILISATEUR.md)](./GUIDE_UTILISATEUR.md)** : Mode d'emploi détaillé par module, rôles, droits et bonnes pratiques.
* 🌐 **[Guide de Déploiement Cloudflare (CLOUDFLARE_GUIDE.md)](./CLOUDFLARE_GUIDE.md)** : Instructions pour déployer sur Cloudflare Pages.

---

## 🚀 Dernières Mises à Jour & Améliorations

### 1. 🔐 Contrôle d'Accès Sécurisé & Modales de Confirmation Personnalisées
* **Modales de Confirmation React (`ConfirmModal`)** : Remplacement des fenêtres de dialogue natives `window.confirm()` par un composant de confirmation sur mesure (`ConfirmModal.tsx`) moderne avec flou d'arrière-plan, boutons Annuler/Supprimer et textes explicatifs clairs. Cela résout définitivement les blocages d'affichage de popups sur navigateurs mobiles et iFrames.
* **Intégration Globale des Modales** : Déployé sur tous les modules clés (Piscine, Magasin Central, Rapports de Ventes, Caisse POS, Tableau de Bord, Historique des Séjours, Chicha et Maintenance).
* **Sécurité Firestore de Suppression (`firestore.rules`)** : Règles de sécurité Firestore mises à jour et déployées pour valider l'autorisation de suppression (`delete`) exclusivement pour les rôles `admin`, `manager` et le compte super-administrateur.
* **Périmètre d'autorisation strict** : Les fonctionnalités de vidange et de suppression massive de données ("Vider le stock", "Zone de Danger", "Vider la base clients", "Effacer toutes les dépenses") sont exclusivement réservées aux utilisateurs autorisés.
* **Droits Réceptionniste Étendus** : Le rôle **Réceptionniste** (`receptionist`) bénéficie des droits d'**ajout de nouvelles chambres** dans le module Hôtel et de **modification des tarifs des tickets de la piscine** (Adultes & Enfants).

### 2. 🔄 Restauration Automatique des Stocks & Nettoyage Lié
* **Restauration de Stock** : Lors de la suppression d'une vente (POS, Rapports, Dashboard, Chicha), les quantités de produits sont automatiquement recréditées sur leur point de vente respectif (Réception, VIP, Terrasse).
* **Nettoyage Cascadiant** : Suppression coordonnée des enregistrements dépendants (tickets piscine, ventes chicha, fiches de réservation) lors de l'annulation d'une transaction financière.

### 2. ⚡ Synchronisation Instantanée et Vidange Réelle de la Base de Données
* **Suppression en Lots Firestore (Batches)** : Traitement optimisé par lots de 400 documents pour purger les collections volumineuses (`products`, `sales`, `rooms`, `pool_tickets`, `bookings`, `expenses`).
* **Purge du Cache Local Synchronisée** : Réinitialisation simultanée des clés `localStorage` associées lors de l'exécution pour éliminer tout risque d'affichage de données résiduelles après le rafraîchissement.
* **Écouteurs Temps Réel Réactifs** : Mise à jour instantanée de l'interface (`onSnapshot`) qui reflète immédiatement la réinitialisation de l'inventaire ou des modules dès que la collection Firestore devient vide.

### 3. 🔔 Badges de Notification Temps Réel Intelligents
Des badges d'alerte visuels rouges avec compteurs dynamiques en temps réel ont été intégrés directement sur la barre de navigation (Sidebar et Mobile) :
* **Cuisine** : Affichage dynamique du nombre de commandes en attente, en préparation ou prêtes.
* **Ménage & Gouvernance** : Décompte en temps réel du nombre de chambres et salles événementielles ayant le statut `À nettoyer`.
* **Maintenance** : Compteur des travaux d'entretien et pannes signalées ou en attente d'intervention.
* **Messagerie / Chat** : Compteur des messages non lus, avec prise en compte sécurisée des discussions privées (DMs) limitées aux participants concernés.

### 4. 🛡️ Robustesse des Écritures Firestore (Fiches Clients CRM)
* Utilisation de `setDoc(..., { merge: true })` pour la gestion des fiches clients lors du Check-In, Check-Out ou édition.
* Prévention totale des erreurs "No document to update" si un identifiant client est généré à la volée ou absent initialement dans Firestore.
* Création ou mise à jour transparente sans rupture d'expérience utilisateur.

### 5. 💵 Module de Clôture de Caisse (POS) Enrichi
Le module Point de Vente (POS) a été enrichi d'un système complet de clôture de caisse quotidienne multi-dimensionnel pour sécuriser et tracer les flux financiers :
* **Calcul Automatique des Ventes & Paiements** : Agrégation en temps réel de toutes les ventes du jour par mode de paiement (Espèces, Carte, Mobile Money, Charges Chambres).
* **Bons de Dépenses du Jour** : Intégration et récapitulatif détaillé des charges et sorties de caisses enregistrées dans la journée par lieu.
* **Rapport de Stock Restant** : Vue synthétique des articles restants en stock, valeur totale valorisée, et alertes pour les articles en stock critique (≤ 5 unités).
* **Vérification des Écarts & Notes** : Saisie du montant d'espèces comptées physiquement avec calcul instantané des écarts (excédent ou déficit) et ajout de notes explicatives.

### 6. 🧾 Impression & Génération PDF Professionnelles
* **Reçu Thermique Direct** : Impression directe optimisée pour les caisses (80mm).
* **Export PDF Haute Définition** : Génération de rapports de clôture et guides au format PDF avec formatage numérique irréprochable (espacement des milliers, suppression des caractères non compressibles) pour une analyse financière parfaite.

### 7. 📲 Partage Intelligent (WhatsApp, SMS, Telegram)
* Intégration de l'**API Web Share** native et d'un système de copie intelligente dans le presse-papiers pour diffuser rapidement les rapports de clôture sur vos canaux de discussion.

### 8. 🛡️ Sécurité de Niveau Production (Firestore Rules)
* Sécurisation stricte dans `firestore.rules` de la collection `/cash_closures` et des collections sensibles (consultation authentifiée, création validée par schéma, et modification/suppression réservée aux administrateurs/managers).

### 9. 🚖 Module Taxi & Améliorations Maintenance
* **Commande Rapide de Taxi via QR Code** : Génération d'un code QR intégré au tableau de bord permettant aux clients de commander un taxi instantanément via une redirection directe vers le module `car-rental`.
* **Amélioration Maintenance (Remplacement de pièces)** : Suivi précis des interventions incluant le remplacement de pièces avec obligation de joindre des photos "Avant/Après" et validation stricte.
* **Notification Optimisée & UX** :
    * Mise à jour optimiste des notifications : validation/rejet instantané pour tous les admins/managers.
    * Ajout d'un bouton "Fermer" (X) sur toutes les notifications.
    * Intégration d'un `ErrorBoundary` global pour une meilleure résilience de l'application.

---

## 🛠️ Stack Technique

* **Framework** : React 18+ (avec TypeScript)
* **Build Tool** : Vite
* **Styling** : Tailwind CSS (utilitaires de design modernes et responsifs)
* **Animations** : Framer Motion (transitions fluides, overlays et feedbacks tactiles)
* **Base de données** : Firebase Firestore (synchronisation temps réel et persistence hors-ligne)
* **Authentification** : Firebase Auth (gestion des sessions et rôles)

---

## 💻 Installation & Développement

### Prérequis
* Node.js (v18+)
* npm ou bun

### Lancement Local
1. Installez les dépendances :
   ```bash
   npm install
   ```
2. Lancez le serveur de développement :
   ```bash
   npm run dev
   ```
3. Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## 🌐 Déploiement

Pour déployer l'application sur **Cloudflare Pages** et configurer l'authentification Firebase sur votre domaine de production, veuillez vous référer au guide détaillé :
👉 **[Guide de déploiement Cloudflare (CLOUDFLARE_GUIDE.md)](./CLOUDFLARE_GUIDE.md)**

