import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './services/firebase';
import { User } from './types';

interface AuthContextType {
  currentUser: User | null; firebaseUser: FirebaseUser | null; loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, phone: string, province: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  adminLogin: (name: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ADMIN_EMAILS = new Set(['clerio1984@gmail.com', 'admin@achei.mz', 'admin@comeback.co.mz']);
const isAdminEmail = (email?: string | null) => !!email && ADMIN_EMAILS.has(email.trim().toLowerCase());

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (unsubscribeUser) { unsubscribeUser(); unsubscribeUser = null; }
      if (!user) { setCurrentUser(null); setLoading(false); return; }
      const userDocRef = doc(db, 'users', user.uid);
      unsubscribeUser = onSnapshot(userDocRef, async (docSnap) => {
        const emailIsAdmin = isAdminEmail(user.email);
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
          const normalizedUser: User = { ...userData, id: user.uid, email: userData.email || user.email || '', isAdmin: emailIsAdmin || userData.isAdmin === true, isSuperAdmin: emailIsAdmin || userData.isSuperAdmin === true };
          setCurrentUser(normalizedUser); setLoading(false);
          if (emailIsAdmin && (!userData.isAdmin || !userData.isSuperAdmin)) setDoc(userDocRef, { isAdmin: true, isSuperAdmin: true }, { merge: true }).catch((error) => console.warn('Could not sync admin profile flags:', error));
          return;
        }
        const fallbackUser: User = { id: user.uid, name: user.displayName || 'Utilizador', email: user.email || '', phone: '', isVerified: false, isAdmin: emailIsAdmin, isSuperAdmin: emailIsAdmin, createdAt: new Date().toISOString() };
        try { await setDoc(userDocRef, fallbackUser, { merge: true }); } catch (error) { console.warn('Could not create user profile:', error); }
        setCurrentUser(fallbackUser); setLoading(false);
      }, (error) => { console.error('User snapshot error:', error); setLoading(false); });
    });
    return () => { unsubscribeAuth(); if (unsubscribeUser) unsubscribeUser(); };
  }, []);

  const login = async () => { await signInWithPopup(auth, new GoogleAuthProvider()); };
  const loginWithEmail = async (email: string, pass: string) => { await signInWithEmailAndPassword(auth, email.trim(), pass); };
  const registerWithEmail = async (email: string, pass: string, name: string, phone: string, province: string) => {
    const cleanPhone = phone.replace(/\D/g, '').replace(/^258(?=\d{9}$)/, '');
    const finalEmail = email.trim() || cleanPhone + '@comeback-mz.com';
    const result = await createUserWithEmailAndPassword(auth, finalEmail, pass);
    await updateProfile(result.user, { displayName: name });
    const newUser: User = { id: result.user.uid, name, email: email.trim(), phone, province, isVerified: false, isAdmin: false, isSuperAdmin: false, createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'users', result.user.uid), newUser);
  };
  const resetPassword = async (email: string) => { await sendPasswordResetEmail(auth, email.trim()); };
  const adminLogin = async (name: string, pass: string) => {
    const normalized = name.trim().toLowerCase();
    const email = (normalized === 'admin' || normalized === 'admin comeback' || normalized === 'admin achei') ? 'admin@comeback.co.mz' : normalized;
    if (!isAdminEmail(email)) throw new Error('Conta de administrador não autorizada.');
    await signInWithEmailAndPassword(auth, email, pass);
  };
  const logout = async () => { setCurrentUser(null); setFirebaseUser(null); await signOut(auth); };
  const updateUserProfile = async (data: Partial<User>) => {
    if (!firebaseUser) return;
    const cleanedData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    try { await setDoc(doc(db, 'users', firebaseUser.uid), cleanedData, { merge: true }); }
    catch (error) { handleFirestoreError(error, OperationType.WRITE, 'users/' + firebaseUser.uid); }
  };
  return <AuthContext.Provider value={{ currentUser, firebaseUser, loading, login, loginWithEmail, registerWithEmail, resetPassword, adminLogin, logout, updateUserProfile }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within an AuthProvider'); return context; };