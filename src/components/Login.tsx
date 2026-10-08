import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Shield, Check, ArrowRight, Sparkles, Building2, LogIn, LogOut, Mail, Lock, HelpCircle, ArrowLeft, Car, RefreshCw } from 'lucide-react';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AppSettings, UserRole, UserProfile } from '../types';
import { toast } from 'sonner';

interface LoginProps {
  onLogin: () => void;
  settings: AppSettings | null;
  user?: UserProfile | null;
}

export const Login = ({ onLogin, settings, user = null }: LoginProps) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('receptionist');
  const [username, setUsername] = useState(user?.username || '');
  const [loading, setLoading] = useState(false);

  // Email/Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [authDomainError, setAuthDomainError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<{ message: string; actionText?: string; onAction?: () => void } | null>(null);

  const roles: { role: UserRole; title: string; desc: string; defaultName: string; color: string }[] = [
    { role: 'admin', title: 'Administrateur', desc: 'Accès complet à tous les modules et paramètres', defaultName: 'Super Administrateur', color: 'bg-emerald-500' },
    { role: 'manager', title: 'Gérant', desc: 'Gestion du stock, tarifs, hôtel et rapports', defaultName: 'Gérant Principal', color: 'bg-teal-500' },
    { role: 'receptionist', title: 'Réceptionniste', desc: 'Gestion des chambres, réservations et clients CRM', defaultName: 'Réceptionniste HQ', color: 'bg-blue-500' },
    { role: 'caissiere', title: 'Caissière (POS)', desc: 'Point de vente, encaissement, cuisine et commandes', defaultName: 'Caisse Principale', color: 'bg-purple-500' },
    { role: 'cook', title: 'Chef Cuisinier / Serveur', desc: 'Gestion des commandes cuisine et terrasse', defaultName: 'Chef Cuisinier', color: 'bg-amber-500' },
    { role: 'valet_de_chambre', title: 'Valet de Chambre', desc: 'Gestion du nettoyage et de l’état des chambres', defaultName: 'Valet de Chambre', color: 'bg-rose-500' },
    { role: 'client', title: 'Client (VOC)', desc: 'Espace d’évaluation et suggestions sur la qualité de service', defaultName: 'Client Résidence', color: 'bg-indigo-500' }
  ];

  const handleClientQuickAccess = () => {
    const clientUser: UserProfile = {
      id: 'client_guest_' + Math.random().toString(36).substr(2, 9),
      username: 'Client Résidence',
      email: 'client@residencehq.com',
      role: 'client'
    };
    localStorage.setItem('simulated_user', JSON.stringify(clientUser));
    toast.success('Bienvenue sur le portail d\'évaluation de la Résidence HQ !');
    try { sessionStorage.clear(); } catch (e) {}
    onLogin();
  };

  // Handle Google auth redirect result on mount
  React.useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          const emailLower = (result.user.email || '').toLowerCase();
          const isOwner = emailLower === 'cyber.kan587@gmail.com';
          const assignedRole: UserRole = isOwner ? 'admin' : 'client';
          const profileData: UserProfile = {
            id: result.user.uid,
            username: result.user.displayName || (isOwner ? 'Super Administrateur' : 'Client Résidence'),
            email: result.user.email || '',
            role: assignedRole
          };
          try {
            await setDoc(doc(db, 'users', result.user.uid), {
              ...profileData,
              createdAt: new Date().toISOString()
            }, { merge: true });
          } catch (e) {}
          localStorage.setItem('simulated_user', JSON.stringify(profileData));
          toast.success(isOwner ? 'Connexion Administrateur réussie !' : 'Bienvenue sur votre Espace Client !');
          try { sessionStorage.clear(); } catch (e) {}
          onLogin();
        }
      })
      .catch((err) => {
        if (err && err.code !== 'auth/popup-closed-by-user') {
          console.warn('Redirect sign-in error:', err);
        }
      });
  }, [onLogin]);

  // Auto-route pending_registration for Gmail users directly to client profile
  React.useEffect(() => {
    if (user && user.role === ('pending_registration' as any)) {
      const emailLower = (user.email || '').toLowerCase();
      const isOwner = emailLower === 'cyber.kan587@gmail.com';
      const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');

      if (isGmail && !isOwner) {
        const clientProfile: UserProfile = {
          id: user.id,
          username: user.username && user.username !== 'Utilisateur' ? user.username : 'Client Résidence',
          email: user.email || '',
          role: 'client'
        };
        (async () => {
          try {
            await setDoc(doc(db, 'users', user.id), {
              ...clientProfile,
              createdAt: new Date().toISOString()
            }, { merge: true });
          } catch (e) {}
          localStorage.setItem('simulated_user', JSON.stringify(clientProfile));
          toast.success('Bienvenue sur votre Espace Client !');
          onLogin();
        })();
      } else if (isOwner) {
        setSelectedRole('admin');
      }
    }
  }, [user, onLogin]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthDomainError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        const emailLower = (result.user.email || '').toLowerCase();
        const isOwner = emailLower === 'cyber.kan587@gmail.com';
        const assignedRole: UserRole = isOwner ? 'admin' : 'client';
        const profileData: UserProfile = {
          id: result.user.uid,
          username: result.user.displayName || (isOwner ? 'Super Administrateur' : 'Client Résidence'),
          email: result.user.email || '',
          role: assignedRole
        };
        try {
          await setDoc(doc(db, 'users', result.user.uid), {
            ...profileData,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("Could not save profile in Firestore:", e);
        }
        localStorage.setItem('simulated_user', JSON.stringify(profileData));
        toast.success(isOwner ? 'Connexion Administrateur réussie !' : 'Bienvenue sur votre Espace Client !');
        try { sessionStorage.clear(); } catch (e) {}
        onLogin();
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.code === 'auth/popup-blocked') {
        toast.info('La fenêtre surgissante a été bloquée. Redirection en cours...');
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr: any) {
          console.error('Google Redirect Error:', redirectErr);
          toast.error('Veuillez autoriser les pop-ups pour ce site dans votre navigateur.');
        }
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthDomainError(window.location.hostname);
        toast.error('Erreur : Domaine non autorisé dans Firebase.');
      } else if (error.code === 'auth/internal-error') {
        toast.error('Erreur interne. Assurez-vous que l\'authentification Google est activée dans la console Firebase et que les cookies tiers sont autorisés.');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        toast.error('Échec de la connexion Google : ' + (error.message || 'Erreur inconnue'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent, forceSignUp = false) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs (email et mot de passe)');
      return;
    }
    setLoading(true);
    setAuthNotice(null);

    const targetSignUp = forceSignUp || isSignUp;

    if (targetSignUp) {
      // Inscription (Sign Up)
      try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        if (res?.user) {
          const emailLower = (res.user.email || '').toLowerCase();
          const isOwner = emailLower === 'cyber.kan587@gmail.com';
          const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');

          const assignedRole: UserRole = isOwner ? 'admin' : (isGmail ? 'client' : 'pending_registration');
          const newProfile: UserProfile = {
            id: res.user.uid,
            username: isOwner ? 'Super Administrateur' : (isGmail ? 'Client Résidence' : 'Nouvel Utilisateur'),
            email: res.user.email || '',
            role: assignedRole
          };

          try {
            await setDoc(doc(db, 'users', res.user.uid), {
              ...newProfile,
              createdAt: new Date().toISOString()
            }, { merge: true });
          } catch (e) {
            console.warn("Could not save profile in Firestore:", e);
          }

          localStorage.setItem('simulated_user', JSON.stringify(newProfile));
          toast.success('Compte créé avec succès ! Bienvenue.');
          try { sessionStorage.clear(); } catch (e) {}
          onLogin();
        }
      } catch (error: any) {
        console.error('Sign Up Error:', error);
        if (error.code === 'auth/email-already-in-use') {
          setAuthNotice({
            message: 'Un compte existe déjà avec cette adresse email. Souhaitez-vous vous connecter ?',
            actionText: 'Se connecter',
            onAction: () => {
              setIsSignUp(false);
              setAuthNotice(null);
            }
          });
        } else if (error.code === 'auth/weak-password') {
          toast.error('Le mot de passe doit comporter au moins 6 caractères.');
        } else if (error.code === 'auth/operation-not-allowed') {
          setAuthNotice({
            message: 'L\'authentification par Email/Mot de passe n\'est pas activée dans votre projet Firebase Console. Utilisez la connexion Google ou l\'Espace Client.',
          });
        } else {
          toast.error('Échec de la création de compte : ' + (error.message || 'Erreur inconnue'));
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Connexion (Sign In)
      try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        if (res?.user) {
          const emailLower = (res.user.email || '').toLowerCase();
          const isOwner = emailLower === 'cyber.kan587@gmail.com';
          const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');

          if (isGmail && !isOwner) {
            const clientProfile: UserProfile = {
              id: res.user.uid,
              username: res.user.displayName || 'Client Résidence',
              email: res.user.email || '',
              role: 'client'
            };
            try {
              await setDoc(doc(db, 'users', res.user.uid), {
                ...clientProfile,
                createdAt: new Date().toISOString()
              }, { merge: true });
            } catch (e) {}
            localStorage.setItem('simulated_user', JSON.stringify(clientProfile));
            toast.success('Bienvenue sur votre Espace Client !');
            try { sessionStorage.clear(); } catch (e) {}
            onLogin();
            return;
          }
        }
        toast.success('Connexion réussie !');
        try { sessionStorage.clear(); } catch (e) {}
        onLogin();
      } catch (error: any) {
        console.error('Auth Error:', error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          setAuthNotice({
            message: 'Email ou mot de passe incorrect. Si c\'est votre première visite, vous devez créer votre compte.',
            actionText: 'Créer un compte avec cet email',
            onAction: () => {
              setIsSignUp(true);
              setAuthNotice(null);
            }
          });
          toast.error('Identifiants incorrects ou compte inexistant.');
        } else if (error.code === 'auth/invalid-email') {
          toast.error('Format de l\'adresse email invalide.');
        } else if (error.code === 'auth/operation-not-allowed') {
          setAuthNotice({
            message: 'L\'authentification par Email/Mot de passe n\'est pas activée dans Firebase Console. Utilisez la connexion Google ou l\'Espace Client.',
          });
          toast.error('Service de connexion par email désactivé.');
        } else {
          toast.error(error.message || 'Erreur d\'authentification');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = forgotEmail || email;
    if (!targetEmail) {
      toast.error('Veuillez saisir votre adresse email');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      toast.success('Email de réinitialisation envoyé ! Vérifiez votre boîte de réception.');
      setShowForgotPassword(false);
    } catch (error: any) {
      console.error('Password Reset Error:', error);
      toast.error('Erreur lors de l\'envoi de l\'email de réinitialisation : ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterProfile = async () => {
    if (!user) return;
    if (!username.trim()) {
      toast.error('Veuillez saisir votre nom d’utilisateur');
      return;
    }

    setLoading(true);
    const emailLower = (user.email || '').toLowerCase();
    const isOwner = emailLower === 'cyber.kan587@gmail.com';
    const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');
    const assignedRole: UserRole = isOwner ? 'admin' : (isGmail ? 'client' : selectedRole);
    const profileData = {
      username: username.trim(),
      email: user.email || '',
      role: assignedRole,
      createdAt: new Date().toISOString()
    };

    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, profileData, { merge: true });

      // Create initial welcome notification ONLY for non-client staff/admin roles (clients must receive NO notification!)
      if (assignedRole !== 'client') {
        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'info',
            message: `🎉 Bienvenue à la Résidence HQ ! Votre profil (${assignedRole}) a été activé avec succès.`,
            timestamp: serverTimestamp(),
            readBy: [],
            targetUserId: user.id
          });
        } catch (e) {
          console.debug("Could not create welcome notification:", e);
        }
      }

      toast.success('Profil enregistré avec succès !');
      try { sessionStorage.clear(); } catch (e) {}
      onLogin();
    } catch (error: any) {
      if (!error?.message?.includes('permissions')) {
        console.warn('Notice saving user profile to Firestore:', error);
      }
      // Fallback: Store session locally so user registration completes uninterrupted
      const localUserProfile: UserProfile = {
        id: user.id,
        username: username.trim(),
        email: user.email || '',
        role: assignedRole
      };
      localStorage.setItem('simulated_user', JSON.stringify(localUserProfile));
      toast.success('Profil activé avec succès !');
      try { sessionStorage.clear(); } catch (e) {}
      onLogin();
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAuth = async () => {
    try {
      await signOut(auth);
      toast.info('Déconnexion réussie.');
    } catch (e) {
      console.error('Sign out error', e);
    }
  };

  // If user is logged in with Firebase but has no profile document, check if Gmail user or show Registration Form
  if (user && user.role === 'pending_registration' as any) {
    const emailLower = (user.email || '').toLowerCase();
    const isOwnerEmail = emailLower === 'cyber.kan587@gmail.com';
    const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');

    // If it's a Gmail user and not the owner, don't show the registration form - auto redirect to client
    if (isGmail && !isOwnerEmail) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-4">
          <div className="flex items-center gap-3 text-[#1A8B8C] font-bold text-sm bg-white p-6 rounded-2xl shadow-md border border-[#E5C198]/30">
            <RefreshCw className="w-5 h-5 animate-spin text-[#1A8B8C]" />
            <span>Accès direct à votre Espace Client en cours...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-4 lg:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-white rounded-3xl border border-[#E5C198]/30 shadow-2xl p-6 lg:p-10 space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-2xl flex items-center justify-center font-bold text-2xl shadow-inner border border-primary/20">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
              ) : (
                <Building2 className="w-8 h-8 text-primary" />
              )}
            </div>
            <h1 className="text-2xl lg:text-2xl md:text-3xl font-bold text-[#2B2321] font-serif italic">
              Créer votre Profil
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-primary/70">
              Complétez vos informations pour accéder à la base de données
            </p>
          </div>

          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#2B2321]/60 font-bold uppercase tracking-widest">Compte connecté</p>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Accès Autorisé (@residencehq.com, @redisencehq.com, @gmail.com)
              </span>
            </div>
            <p className="font-bold text-[#2B2321] text-sm">{user.email}</p>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60 block">
              Nom complet / d'affichage
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-primary absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-xl outline-none font-bold text-[#2B2321] focus:border-primary transition-all"
                placeholder="Ex: Jean Dupont"
              />
            </div>
          </div>

          {isOwnerEmail ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200/60 rounded-2xl text-xs text-emerald-800 space-y-1">
              <p className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Administrateur Principal Reconnu
              </p>
              <p>Votre adresse email <strong>{user.email}</strong> est identifiée comme le propriétaire de la base de données. Le rôle <strong>Administrateur</strong> vous est automatiquement attribué.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60 block">
                Choisissez votre rôle d'accès
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roles.filter(r => r.role !== 'admin').map((r) => {
                  const isSelected = selectedRole === r.role;
                  return (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => setSelectedRole(r.role)}
                      className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 relative cursor-pointer ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20' 
                          : 'border-[#E5C198]/30 bg-[#FDFBF7] hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${r.color}`} />
                      <div className="flex-1 pr-4">
                        <p className="font-bold text-sm text-[#2B2321]">{r.title}</p>
                        <p className="text-[11px] text-[#2B2321]/60 mt-0.5 leading-tight">{r.desc}</p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary absolute top-4 right-4" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <button
              onClick={handleRegisterProfile}
              disabled={loading}
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer text-base disabled:opacity-50"
            >
              {loading ? (
                <span>Enregistrement en cours...</span>
              ) : (
                <>
                  <span>Créer mon profil & Accéder</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={handleLogoutAuth}
              className="w-full py-3 bg-red-50 hover:bg-red-100/80 text-red-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter (Changer de compte)</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Forgot Password Reset Screen
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-4 lg:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl border border-[#E5C198]/30 shadow-2xl p-6 lg:p-8 space-y-6"
        >
          <div className="text-center space-y-2">
            <button 
              onClick={() => setShowForgotPassword(false)}
              className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la connexion</span>
            </button>
            <div className="w-16 h-16 mx-auto bg-primary/10 text-primary rounded-2xl flex items-center justify-center font-bold text-2xl shadow-inner border border-primary/20">
              <HelpCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-[#2B2321] font-serif italic animate-pulse">
              Mot de passe oublié
            </h1>
            <p className="text-xs text-[#2B2321]/60 leading-relaxed">
              Saisissez votre email ci-dessous pour recevoir un lien de réinitialisation de mot de passe par email.
            </p>
          </div>

          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60 block">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-primary absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="email" 
                  value={forgotEmail || email}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-xl outline-none font-bold text-[#2B2321] focus:border-primary transition-all text-sm"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50"
            >
              {loading ? (
                <span>Envoi en cours...</span>
              ) : (
                <>
                  <span>Envoyer l'email de réinitialisation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Standard Landing Login Screen with Email/Password & Google Sign-In
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-4 lg:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl border border-[#E5C198]/30 shadow-2xl p-6 lg:p-8 space-y-6 text-center"
      >
        <div className="space-y-3">
          <div className="w-20 h-20 mx-auto bg-primary/10 text-primary rounded-3xl flex items-center justify-center font-bold text-2xl shadow-inner border border-primary/20">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.src = '/logo.png'; }} />
            ) : (
              <Building2 className="w-10 h-10 text-primary" />
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2B2321] font-serif italic">
            {settings?.hotelName || 'Résidence HQ'}
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-primary/70">
            Système de Gestion Hôtelière & POS
          </p>
        </div>

        {authDomainError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-950 space-y-3">
            <div className="flex gap-2 items-start">
              <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider text-amber-800">Domaine non autorisé dans Firebase</p>
                <p className="mt-1 leading-relaxed">
                  L'authentification Google a échoué car le domaine actuel n'est pas autorisé dans votre projet Firebase.
                </p>
              </div>
            </div>
            
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50 space-y-1">
              <p className="font-bold text-[10px] uppercase tracking-wider text-amber-700">Domaine à ajouter :</p>
              <code className="block p-1.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px] select-all break-all text-center font-bold">
                {authDomainError}
              </code>
            </div>

            <div className="space-y-1.5 leading-relaxed text-[#2B2321]/80">
              <p className="font-bold text-[11px]">Comment résoudre ce problème :</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] pl-1">
                <li>Ouvrez votre <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary font-bold underline">Console Firebase</a>.</li>
                <li>Sélectionnez votre projet <strong>residence-hq</strong>.</li>
                <li>Allez dans <strong>Authentification</strong> &gt; Onglet <strong>Paramètres</strong> &gt; <strong>Domaines autorisés</strong>.</li>
                <li>Cliquez sur <strong>Ajouter un domaine</strong> et collez le domaine ci-dessus.</li>
              </ol>
              <p className="text-[10px] text-amber-800/80 italic mt-2">
                Note : Si vous n'êtes pas le propriétaire du projet Firebase, vous devez demander au propriétaire (le créateur du projet Firebase) de vous accorder le rôle d'Administrateur ou d'ajouter ce domaine pour vous.
              </p>
            </div>
            
            <button 
              type="button" 
              onClick={() => setAuthDomainError(null)}
              className="w-full py-1.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-800 font-bold rounded-lg transition-all text-[11px] cursor-pointer"
            >
              Masquer cette alerte
            </button>
          </div>
        )}

        {/* Mode Toggle Tabs: Connexion / Inscription */}
        <div className="flex bg-[#FDFBF7] p-1 rounded-2xl border border-[#E5C198]/40">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setAuthNotice(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !isSignUp 
                ? 'bg-white text-primary shadow-sm border border-[#E5C198]/30' 
                : 'text-[#2B2321]/60 hover:text-primary'
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setAuthNotice(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isSignUp 
                ? 'bg-white text-primary shadow-sm border border-[#E5C198]/30' 
                : 'text-[#2B2321]/60 hover:text-primary'
            }`}
          >
            Créer un compte
          </button>
        </div>

        {authNotice && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-950 space-y-2.5 animate-fadeIn">
            <div className="flex gap-2 items-start">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium text-[11px]">{authNotice.message}</p>
            </div>
            {authNotice.actionText && authNotice.onAction && (
              <button
                type="button"
                onClick={authNotice.onAction}
                className="w-full py-2 bg-primary text-white font-bold rounded-xl transition-all text-xs cursor-pointer hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{authNotice.actionText}</span>
              </button>
            )}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={(e) => handleEmailAuth(e)} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60">
              Adresse Email
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-primary/70 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-xl outline-none font-bold text-[#2B2321] focus:border-primary transition-all text-sm"
                placeholder="votre@email.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-widest text-[#2B2321]/60">
                Mot de Passe
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotPassword(true);
                  }}
                  className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-primary/70 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#FDFBF7] border border-[#E5C198]/40 rounded-xl outline-none font-bold text-[#2B2321] focus:border-primary transition-all text-sm"
                placeholder="••••••"
                minLength={6}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50"
          >
            {isSignUp ? <Sparkles className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            <span>
              {loading 
                ? (isSignUp ? 'Création de compte...' : 'Connexion...') 
                : (isSignUp ? 'Créer mon compte' : 'Se connecter')
              }
            </span>
          </button>
        </form>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-[#E5C198]/20"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-[#2B2321]/40 font-bold">Ou</span>
          </div>
        </div>

        {/* Google Sign-In as secondary elegant method */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 bg-white border border-[#E5C198]/40 hover:border-primary/50 hover:bg-[#FDFBF7] text-[#2B2321] font-bold rounded-2xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer text-sm disabled:opacity-50 active:scale-[0.99]"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span className="text-sm font-bold">Se connecter avec Google</span>
        </button>

        <button
          type="button"
          onClick={handleClientQuickAccess}
          className="w-full py-3 bg-gradient-to-r from-primary/5 via-secondary/10 to-primary/5 hover:from-primary/10 hover:via-secondary/15 hover:to-primary/10 text-primary border border-primary/20 hover:border-primary/40 font-bold rounded-2xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer text-sm"
        >
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span>Espace Client : Émettre un Avis (VOC)</span>
        </button>

        <div className="p-2.5 bg-[#FDFBF7] border border-[#E5C198]/30 rounded-xl text-center text-[10px] text-[#2B2321]/60 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="font-medium">Cette application est conçue par : <strong>Empreintes Technologies</strong>.</p>
        </div>
      </motion.div>
    </div>
  );
};
