import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import i18n, { setAppLanguage } from '../i18n';

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [demoDate, setDemoDateState] = useState('2026-10-22');
  const [business, setBusiness] = useState(null);
  const [safetyBufferPaise, setSafetyBufferPaise] = useState(50000000); // ₹5,00,000
  const [language, setLanguageState] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('baaki_language')) || 'en');
  const [textSize, setTextSizeState] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('baaki_text_size')) || 'normal');
  const [loading, setLoading] = useState(true);

  // Sync state when i18n language changes
  useEffect(() => {
    const handleLang = (lng) => {
      setLanguageState(lng);
    };
    i18n.on('languageChanged', handleLang);
    return () => {
      i18n.off('languageChanged', handleLang);
    };
  }, []);

  // Apply text size to root document
  useEffect(() => {
    document.documentElement.classList.remove('text-size-normal', 'text-size-large', 'text-size-xlarge');
    document.documentElement.classList.add(`text-size-${textSize}`);
    localStorage.setItem('baaki_text_size', textSize);
  }, [textSize]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings');
      if (data) {
        if (data.today) setDemoDateState(data.today);
        else if (data.demo_date) setDemoDateState(data.demo_date);

        if (data.business) setBusiness(data.business);
        if (data.safety_buffer_paise) setSafetyBufferPaise(Number(data.safety_buffer_paise));
        if (data.language) setLanguageState(data.language);
        if (data.text_size) setTextSizeState(data.text_size);
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateDemoDate = async (newDate) => {
    try {
      const res = await api.put('/settings', {
        demo_date: newDate,
        demoDate: newDate
      });
      setDemoDateState(newDate);
      if (res.business) setBusiness(res.business);
      window.dispatchEvent(new CustomEvent('baaki_demo_date_changed', { detail: newDate }));
      return res;
    } catch (err) {
      throw err;
    }
  };

  const updateSafetyBuffer = async (paise) => {
    try {
      const res = await api.put('/settings', {
        safety_buffer_paise: String(paise)
      });
      setSafetyBufferPaise(paise);
      window.dispatchEvent(new CustomEvent('baaki_settings_changed'));
      return res;
    } catch (err) {
      throw err;
    }
  };

  const updateBusiness = async (bizData) => {
    try {
      const res = await api.put('/settings/business', bizData);
      setBusiness(res);
      window.dispatchEvent(new CustomEvent('baaki_settings_changed'));
      return res;
    } catch (err) {
      throw err;
    }
  };

  const resetDemo = async () => {
    try {
      const res = await api.post('/settings/reset-demo', { confirm: true });
      setDemoDateState('2026-10-22');
      if (res.business) setBusiness(res.business);
      window.dispatchEvent(new CustomEvent('baaki_demo_date_changed', { detail: '2026-10-22' }));
      return res;
    } catch (err) {
      throw err;
    }
  };

  const setTextSize = (size) => {
    setTextSizeState(size);
    api.put('/settings', { text_size: size }).catch(() => {});
  };

  const setLanguage = (lang) => {
    setLanguageState(lang);
    setAppLanguage(lang);
  };

  return (
    <DemoContext.Provider
      value={{
        demoDate,
        business,
        safetyBufferPaise,
        language,
        textSize,
        loading,
        updateDemoDate,
        updateSafetyBuffer,
        updateBusiness,
        resetDemo,
        setTextSize,
        setLanguage,
        refreshSettings: loadSettings
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error('useDemo must be used within DemoProvider');
  }
  return ctx;
}

export default DemoContext;
