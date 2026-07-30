import React, { createContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AppContext = createContext();

const initialState = {
  cart: [],
  storeName: 'MarketPos',
  storeLogo: null,
  printerAddress: null,
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
    case 'LOAD_SETTINGS':
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load settings from AsyncStorage on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storeName = await AsyncStorage.getItem('storeName');
        const storeLogo = await AsyncStorage.getItem('storeLogo');
        const printerAddress = await AsyncStorage.getItem('printerAddress');
        dispatch({
          type: 'LOAD_SETTINGS',
          payload: {
            storeName: storeName || 'MarketPos',
            storeLogo: storeLogo || null,
            printerAddress: printerAddress || null,
          }
        });
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    };
    loadSettings();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
