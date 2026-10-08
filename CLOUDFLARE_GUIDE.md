# Guide de Déploiement sur Cloudflare Pages 🚀

L'application **ResidenceHQ** est entièrement configurée pour un déploiement rapide et optimisé sur **Cloudflare Pages**.

---

## 🛠️ Configuration Incluses Dans le Projet

1. **Routing SPA (`public/_redirects`)** : Garantit que le rafraîchissement des pages (ex: `/dashboard`, `/pos`, etc.) redirige vers `index.html` sans erreur 404.
2. **Configuration Wrangler (`wrangler.toml`)** : Définit le répertoire de build (`./dist`) et la compatibilité Cloudflare.
3. **Scripts npm (`package.json`)** : Commandes de build et de déploiement en une seule étape.

---

## 📌 Méthode 1 : Déploiement Direct via Ligne de Commande (Wrangler CLI)

C'est la méthode la plus rapide si vous utilisez la CLI.

1. **Installez / Connectez-vous à Cloudflare** (si ce n'est pas déjà fait) :
   ```bash
   npx wrangler login
   ```
2. **Lancez la commande de déploiement** :
   ```bash
   npm run deploy:cloudflare
   ```
3. Suivez les instructions à l'écran pour sélectionner ou créer votre projet Cloudflare Pages.

---

## 🌐 Méthode 2 : Déploiement Automatique via GitHub / Git

Si votre code est hébergé sur GitHub ou GitLab :

1. Allez sur le [Tableau de bord Cloudflare](https://dash.cloudflare.com/).
2. Accédez à **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Sélectionnez votre dépôt Git.
4. Configurez les paramètres de build suivants :
   - **Framework preset** : `Vite` (ou `None`)
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
   - **Node.js Version** (Variables d'environnement) : `NODE_VERSION = 20`
5. Cliquez sur **Save and Deploy**.

---

## 🔑 Variables d'Environnement et Sécurité (Firebase)

### 1. Domaines Autorisés
N'oubliez pas d'ajouter les domaines autorisés dans votre console **Firebase Authentication** :
1. Allez sur la **Console Firebase** > **Authentication** > **Settings** > **Authorized domains**.
2. Ajoutez votre domaine Cloudflare Pages (ex: `residence-hq.pages.dev` ou votre nom de domaine personnalisé).

### 2. Déploiement des Règles de Sécurité Firestore
Avec l'ajout de la fonctionnalité de **Clôture de Caisse**, de nouvelles règles de sécurité ont été définies dans `firestore.rules` pour valider l'intégrité des rapports de fermeture et restreindre leur accès.

Pour déployer ces règles :
* Si vous utilisez le CLI Firebase localement :
  ```bash
  firebase deploy --only firestore:rules
  ```
* *Note : Les règles de sécurité ont été automatiquement validées et appliquées sur votre base de données active par l'assistant IA lors de la mise à jour.*

---

## 🧾 Fonctionnalités POS : Clôture de Caisse (Impression & Partage)

Le système de Point de Vente (POS) intègre désormais un module complet de clôture de caisse quotidienne :
1. **Calcul Automatique** : Récupère et filtre les ventes et tickets du jour en fonction du caissier connecté, sans nécessiter d'index composite Firebase (optimisé contre les erreurs d'indexation).
2. **Impression Thermique Directe** : Le bouton **Imprimer** formate et isole uniquement le reçu de clôture en noir et blanc haute lisibilité pour les imprimantes thermiques standard.
3. **Partage Intelligent** : Le bouton **Partager** utilise l'API Web Share native de votre appareil (mobile/tablette) ou copie automatiquement un rapport textuel élégamment formaté (avec emojis et séparateurs) dans le presse-papiers pour envoi immédiat sur WhatsApp, Telegram ou par SMS.
