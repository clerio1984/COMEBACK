import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './services/firebase';
import { User } from './types';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, phone: string, province: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  adminLogin: (name: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAdminMode, setIsAdminMode] = useState(() => {
    try {
      return localStorage.getItem('comeback_isAdminMode') === 'true';
    } catch {
      return false;
    }
  });

  const setAdminModeAndPersist = (val: boolean) => {
    setIsAdminMode(val);
    try {
      if (val) {
        localStorage.setItem('comeback_isAdminMode', 'true');
      } else {
        localStorage.removeItem('comeback_isAdminMode');
      }
    } catch (e) {
      console.error("Error writing admin mode to localStorage:", e);
    }
  };

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // If we are in admin mode, don't let onAuthStateChanged wipe the session
      if (isAdminMode && !user) {
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            // Force admin status for the specific admin email if not already set
            if ((user.email === 'clerio1984@gmail.com' || user.email === 'admin@comeback.co.mz') && (!userData.isAdmin || !userData.isSuperAdmin)) {
               setCurrentUser({ ...userData, isAdmin: true, isSuperAdmin: true });
               setDoc(userDocRef, { isAdmin: true, isSuperAdmin: true }, { merge: true })
                 .catch(err => console.warn("Could not auto-sync admin flags:", err));
            } else {
               setCurrentUser(userData);
            }
            setLoading(false);
          } else {
            // Self-healing: Document doesn't exist yet but user is logged in. Auto-create.
            const fallbackUser: User = {
              id: user.uid,
              name: user.displayName || 'Utilizador',
              email: user.email || '',
              phone: '',
              isVerified: false,
              isAdmin: user.email === 'clerio1984@gmail.com' || user.email === 'admin@comeback.co.mz',
              isSuperAdmin: user.email === 'clerio1984@gmail.com' || user.email === 'admin@comeback.co.mz',
              createdAt: new Date().toISOString()
            };
            setDoc(userDocRef, fallbackUser, { merge: true })
              .then(() => {
                setCurrentUser(fallbackUser);
                setLoading(false);
              })
              .catch((err) => {
                console.warn("Could not auto-create missing user document:", err);
                setCurrentUser(fallbackUser);
                setLoading(false);
              });
          }
        }, (error) => {
          console.error("User snapshot error:", error);
          setLoading(false);
        });
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [isAdminMode]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      
      if (!docSnap.exists()) {
        const newUser: User = {
          id: user.uid,
          name: user.displayName || 'Utilizador',
          email: user.email || '',
          phone: '',
          isVerified: false,
          isAdmin: user.email === 'clerio1984@gmail.com',
          isSuperAdmin: user.email === 'clerio1984@gmail.com',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newUser);
      } else {
        // If already exists, ensure admin status is synced if email matches
        if (user.email === 'clerio1984@gmail.com') {
          const userData = docSnap.data() as User;
          if (!userData.isAdmin || !userData.isSuperAdmin) {
            await setDoc(userDocRef, { isAdmin: true, isSuperAdmin: true }, { merge: true });
          }
        }
      }
      setAdminModeAndPersist(false);
    } catch (error) {
      console.warn("Login error:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setAdminModeAndPersist(false);
    } catch (error: any) {
      console.warn("Login with email error:", error);
      
      const isMissingCred = 
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/user-not-found' ||
        error.message?.includes('invalid-credential') ||
        error.message?.includes('user-not-found');

      if (isMissingCred) {
        try {
          console.log("Auto-healing: Attempting dynamic registration for newly provisioned backend:", email);
          const result = await createUserWithEmailAndPassword(auth, email, pass);
          const user = result.user;
          
          const baseName = email.split('@')[0];
          const displayName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
          await updateProfile(user, { displayName });
          
          const userDocRef = doc(db, 'users', user.uid);
          const newUser: User = {
            id: user.uid,
            name: displayName,
            email: email,
            phone: '',
            isVerified: false,
            isAdmin: email === 'clerio1984@gmail.com' || email === 'admin@comeback.co.mz',
            isSuperAdmin: email === 'clerio1984@gmail.com' || email === 'admin@comeback.co.mz',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, newUser, { merge: true });
          setAdminModeAndPersist(false);
          return;
        } catch (regErr: any) {
          console.warn("Auto-registration fallback failed:", regErr);
          // If the email is already in use, the user exists but password is bad
          if (regErr.code === 'auth/email-already-in-use' || regErr.message?.includes('email-already-in-use')) {
            throw error;
          }
        }
      }
      throw error;
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string, phone: string, province: string) => {
    try {
      // Firebase requires an email. If user didn't provide one, generate a dummy one based on phone.
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('258') && cleanPhone.length > 8) {
        cleanPhone = cleanPhone.slice(3);
      }
      const finalEmail = email.trim() || `${cleanPhone}@comeback-mz.com`;
      
      const result = await createUserWithEmailAndPassword(auth, finalEmail, pass);
      const user = result.user;
      
      // Update Firebase Profile Name
      await updateProfile(user, { displayName: name });
      
      // Create Firestore User Document
      const userDocRef = doc(db, 'users', user.uid);
      const newUser: User = {
        id: user.uid,
        name: name,
        email: email, // Can be empty string as requested (optional)
        phone: phone,
        province: province,
        isVerified: false,
        isAdmin: finalEmail === 'clerio1984@gmail.com',
        isSuperAdmin: finalEmail === 'clerio1984@gmail.com',
        createdAt: new Date().toISOString()
      };
      await setDoc(userDocRef, newUser);
      setAdminModeAndPersist(false);
    } catch (error) {
      console.warn("Registration error:", error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.warn("Reset password error:", error);
      throw error;
    }
  };

  const adminLogin = async (name: string, pass: string) => {
    const isMatchedName = 
      name === 'Admin Achei' || 
      name === 'Admin ComeBack' || 
      name === 'admin' || 
      name === 'admin@comeback.co.mz' || 
      name === 'admin@achei.mz';

    if (isMatchedName && pass === 'FireW@ll321') {
      const adminEmail = 'admin@comeback.co.mz';
      let user: FirebaseUser;
      try {
        const res = await signInWithEmailAndPassword(auth, adminEmail, pass);
        user = res.user;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.message?.includes('user-not-found') || err.code === 'auth/invalid-credential') {
          const res = await createUserWithEmailAndPassword(auth, adminEmail, pass);
          user = res.user;
        } else {
          console.error("Firebase admin login error:", err);
          throw err;
        }
      }

      const userDocRef = doc(db, 'users', user.uid);
      const adminUser: User = {
        id: user.uid,
        name: 'Administrador ComeBack',
        email: adminEmail,
        phone: '+258 84 000 0000',
        isVerified: true,
        isAdmin: true,
        isSuperAdmin: true,
        createdAt: new Date().toISOString()
      };
      
      try {
        await setDoc(userDocRef, adminUser, { merge: true });
      } catch (e) {
        console.warn("Could not sync admin to Firestore (expected in prototype):", e);
      }
      
      setAdminModeAndPersist(true);
      setCurrentUser(adminUser);
      setFirebaseUser(user);
    } else {
      throw new Error("Credenciais Inválidas");
    }
  };

  const logout = async () => {
    setAdminModeAndPersist(false);
    setCurrentUser(null);
    setFirebaseUser(null);
    await signOut(auth);
  };

  const updateUserProfile = async (data: Partial<User>) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    
    // Remove undefined values to avoid Firestore errors
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    
    try {
      await setDoc(userDocRef, cleanedData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users/' + firebaseUser.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      firebaseUser, 
      loading, 
      login, 
      loginWithEmail,
      registerWithEmail,
      resetPassword,
      adminLogin, 
      logout, 
      updateUserProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
