// src/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB2-FvLJMbd3CcawwI92eI5X4u66smW_qk",
  authDomain: "sarithadairy-fdfbd.firebaseapp.com",
  projectId: "sarithadairy-fdfbd",
  storageBucket: "sarithadairy-fdfbd.firebasestorage.app",
  messagingSenderId: "463424004464",
  appId: "1:463424004464:web:f0138df5c68399e3b9efb5",
  measurementId: "G-5GGNRC53E7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const ADMIN_EMAIL = 'narendrareddybadam553@gmail.com';

export const isAdmin = (email) => email?.toLowerCase() === ADMIN_EMAIL;

// ✅ Get delivery boys from localStorage (where admin saves them)
const getDeliveryBoysFromStorage = () => {
  return JSON.parse(localStorage.getItem('deliveryBoys') || '[]');
};

// Admin Login
export const loginWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (!isAdmin(email)) {
      await signOut(auth);
      return { success: false, error: 'Only admin can login' };
    }
    sessionStorage.setItem('userRole', 'admin');
    sessionStorage.setItem('userData', JSON.stringify({ email, role: 'admin', name: 'Admin' }));
    console.log('✅ Admin logged in');
    return { success: true, role: 'admin' };
  } catch (error) {
    console.error('Admin login error:', error);
    return { success: false, error: error.message };
  }
};

// Google Login
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (!isAdmin(result.user.email)) {
      await signOut(auth);
      return { success: false, error: 'Only admin can login with Google' };
    }
    sessionStorage.setItem('userRole', 'admin');
    sessionStorage.setItem('userData', JSON.stringify({ 
      email: result.user.email, role: 'admin', name: result.user.displayName 
    }));
    console.log('✅ Admin logged in via Google');
    return { success: true, role: 'admin' };
  } catch (error) {
    console.error('Google login error:', error);
    return { success: false, error: error.message };
  }
};

// ✅ DELIVERY BOY LOGIN - Now reads from localStorage (where admin adds them)
export const loginDeliveryBoy = (phone, password) => {
  console.log('🔍 Looking for delivery boy with phone:', phone);
  
  // ✅ Get delivery boys from localStorage
  const boys = getDeliveryBoysFromStorage();
  console.log('📋 All delivery boys in storage:', boys);
  
  if (boys.length === 0) {
    console.log('❌ No delivery boys found in storage');
    return { success: false, error: 'No delivery boys registered. Contact admin.' };
  }
  
  // Find matching delivery boy
  const boy = boys.find(db => db.phone === phone && db.password === password);
  console.log('👤 Found boy:', boy);
  
  if (!boy) {
    // Check if phone exists but wrong password
    const phoneExists = boys.find(db => db.phone === phone);
    if (phoneExists) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }
    return { success: false, error: 'Invalid phone number. Contact admin to register.' };
  }
  
  if (boy.status === 'inactive') {
    return { success: false, error: 'Your account is deactivated. Contact admin.' };
  }
  
  // ✅ Save delivery boy session
  sessionStorage.setItem('userRole', 'delivery');
  sessionStorage.setItem('userData', JSON.stringify({
    id: boy.id,
    name: boy.name,
    phone: boy.phone,
    email: boy.email || '',
    vehicle: boy.vehicle || '',
    area: boy.area || '',
    role: 'delivery'
  }));
  
  console.log('✅ Delivery boy logged in successfully:', boy.name);
  
  return { 
    success: true, 
    role: 'delivery', 
    userData: { 
      id: boy.id, 
      name: boy.name, 
      phone: boy.phone,
      email: boy.email || '',
      vehicle: boy.vehicle || '',
      area: boy.area || '',
      role: 'delivery' 
    } 
  };
};

// Logout
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.log('Signout error:', error.message);
  }
  sessionStorage.clear();
  console.log('✅ User logged out, session cleared');
  return { success: true };
};

// Get current user from session
export const getCurrentUser = () => {
  try {
    const role = sessionStorage.getItem('userRole');
    const data = sessionStorage.getItem('userData');
    
    console.log('🔍 getCurrentUser - Role:', role, 'Data:', data);
    
    if (!role || !data) return null;
    
    return { role, ...JSON.parse(data) };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// ✅ Debug function - Check all stored data
export const debugStorage = () => {
  console.log('=== STORAGE DEBUG ===');
  console.log('deliveryBoys:', JSON.parse(localStorage.getItem('deliveryBoys') || '[]'));
  console.log('customers:', JSON.parse(localStorage.getItem('customers') || '[]'));
  console.log('session userRole:', sessionStorage.getItem('userRole'));
  console.log('session userData:', sessionStorage.getItem('userData'));
  console.log('====================');
};

export default app;