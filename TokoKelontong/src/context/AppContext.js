import React, { createContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  getStoreLogoKey,
  getStoreNameKey,
  getStoreProfileKey,
  getBusinessModeKey,
  clearLegacyGlobalStoreKeys,
} from '../services/sessionStore';

export const AppContext = createContext();

const initialState = {
  cart: [],
  storeName: 'MarketPos',
  storeLogo: null,
  printerAddress: null,
  printerName: null,
  businessMode: 'retail', // 'retail' (Toko/Kelontong) atau 'fnb' (Resto/Kafe)
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existingItem = state.cart.find(item => item.product_id === action.payload.product_id);
      if (existingItem) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.product_id === action.payload.product_id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, quantity: 1 }] };
    }
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(item => item.product_id !== action.payload.product_id),
      };
    case 'UPDATE_CART_QTY':
      return {
        ...state,
        cart: state.cart.map(item =>
          item.product_id === action.payload.product_id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'SET_STORE_NAME':
      return { ...state, storeName: action.payload };
    case 'SET_STORE_LOGO':
      return { ...state, storeLogo: action.payload };
    case 'SET_PRINTER_ADDRESS':
      return { ...state, printerAddress: action.payload };
    case 'SET_PRINTER_NAME':
      return { ...state, printerName: action.payload };
    case 'SET_BUSINESS_MODE':
      return { ...state, businessMode: action.payload };
    case 'LOAD_SETTINGS':
      return { ...state, ...action.payload };
    case 'RESET_STORE_STATE':
      return {
        ...state,
        cart: [],
        storeName: 'MarketPos',
        storeLogo: null,
        businessMode: 'retail',
      };
    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { session, profile } = useAuth();
  const sessionUserId = session?.user?.id || null;
  const activeStoreId = profile?.store_id || profile?.stores?.id || null;
  const cloudStoreName = profile?.stores?.store_name || null;

  // Pengaturan printer bersifat per perangkat fisik, dimuat sekali saat awal.
  useEffect(() => {
    let cancelled = false;
    const loadDevicePrinter = async () => {
      try {
        const printerAddress = await AsyncStorage.getItem('printerAddress');
        const printerName = await AsyncStorage.getItem('printerName');
        if (cancelled) return;
        dispatch({
          type: 'LOAD_SETTINGS',
          payload: {
            printerAddress: printerAddress || null,
            printerName: printerName || null,
          },
        });
      } catch (error) {
        console.error('Failed to load printer settings', error);
      }
    };
    loadDevicePrinter();
    return () => {
      cancelled = true;
    };
  }, []);

  // Identitas toko (logo, nama, mode bisnis) wajib terisolasi per store_id
  // agar pergantian akun pada HP yang sama tidak pernah membocorkan logo/profil toko lain.
  useEffect(() => {
    let cancelled = false;

    if (!sessionUserId) {
      dispatch({ type: 'RESET_STORE_STATE' });
      void clearLegacyGlobalStoreKeys();
      return () => {
        cancelled = true;
      };
    }

    if (!activeStoreId) {
      dispatch({
        type: 'LOAD_SETTINGS',
        payload: {
          storeName: cloudStoreName || 'MarketPos',
          storeLogo: null,
          businessMode: 'retail',
        },
      });
      return () => {
        cancelled = true;
      };
    }

    const loadScopedStoreSettings = async () => {
      try {
        await clearLegacyGlobalStoreKeys();
        const logoKey = getStoreLogoKey(activeStoreId);
        const nameKey = getStoreNameKey(activeStoreId);
        const profileKey = getStoreProfileKey(activeStoreId);
        const modeKey = getBusinessModeKey(activeStoreId);

        const [storeLogo, scopedName, rawProfile, businessMode] = await Promise.all([
          logoKey ? AsyncStorage.getItem(logoKey) : null,
          nameKey ? AsyncStorage.getItem(nameKey) : null,
          profileKey ? AsyncStorage.getItem(profileKey) : null,
          modeKey ? AsyncStorage.getItem(modeKey) : null,
        ]);

        let profileLogo = null;
        if (rawProfile) {
          try {
            const parsed = JSON.parse(rawProfile);
            profileLogo = parsed?.logo || null;
          } catch {
            profileLogo = null;
          }
        }

        if (cancelled) return;
        dispatch({
          type: 'LOAD_SETTINGS',
          payload: {
            storeName: cloudStoreName || scopedName || 'MarketPos',
            storeLogo: storeLogo || profileLogo || null,
            businessMode: businessMode === 'fnb' ? 'fnb' : 'retail',
          },
        });
      } catch (error) {
        console.error('Failed to load scoped store settings', error);
      }
    };

    loadScopedStoreSettings();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId, activeStoreId, cloudStoreName]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
