import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearModelConfig,
  fetchModelConfigStatus,
  saveModelConfig,
  testModelConfig,
} from '../modules/agent/modelConfigClient.js';

const ModelConfigState = createContext(null);

export function ModelConfigProvider({ children }) {
  const [status, setStatus] = useState({ configured: false, source: 'unknown' });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchModelConfigStatus();
      setStatus(result.config || { configured: false, source: 'unknown' });
      setError('');
      return result.config;
    } catch (reason) {
      setError(reason.message || '无法读取模型配置。');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveAndTest = useCallback(async (input) => {
    setBusy(true);
    setError('');
    try {
      const saved = await saveModelConfig(input);
      setStatus(saved.config || status);
      const tested = await testModelConfig();
      setStatus(tested.config || saved.config || status);
      return { ...tested, warning: tested.warning || saved.warning || '' };
    } catch (reason) {
      setError(reason.message || '模型配置或连接测试失败。');
      throw reason;
    } finally {
      setBusy(false);
    }
  }, [status]);

  const clear = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await clearModelConfig();
      setStatus(result.config || { configured: false, source: 'unknown' });
      return result;
    } catch (reason) {
      setError(reason.message || '清除模型配置失败。');
      throw reason;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(() => ({
    status,
    isOpen,
    setIsOpen,
    open: () => { setError(''); setIsOpen(true); },
    close: () => setIsOpen(false),
    loading,
    busy,
    error,
    setError,
    refresh,
    saveAndTest,
    clear,
  }), [busy, clear, error, isOpen, loading, refresh, saveAndTest, status]);

  return <ModelConfigState.Provider value={value}>{children}</ModelConfigState.Provider>;
}

export function useModelConfig() {
  const value = useContext(ModelConfigState);
  if (!value) throw new Error('useModelConfig must be used inside ModelConfigProvider');
  return value;
}
