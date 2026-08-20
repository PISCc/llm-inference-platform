import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const PptExportState = createContext(null);

export function PptExportProvider({ children }) {
  const [request, setRequest] = useState(null);
  const openPptExport = useCallback((source = {}) => {
    setRequest({ id: Date.now(), ...source });
  }, []);
  const closePptExport = useCallback(() => setRequest(null), []);
  const value = useMemo(() => ({ request, openPptExport, closePptExport }), [closePptExport, openPptExport, request]);
  return <PptExportState.Provider value={value}>{children}</PptExportState.Provider>;
}

export function usePptExport() {
  const value = useContext(PptExportState);
  if (!value) throw new Error('usePptExport must be used inside PptExportProvider');
  return value;
}

