import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EMPTY_PAGE_CONTEXT, mergePageContexts, normalizePageContext } from './pageContextContract.js';

const PageContextState = createContext(null);

export function PageContextProvider({ children }) {
  const { pathname } = useLocation();
  const [registrations, setRegistrations] = useState({});

  const registerContext = useCallback((sourceId, context, priority = 0) => {
    const registrationId = `${pathname}:${sourceId}`;
    const nextRegistration = {
      sourceId,
      route: pathname,
      priority,
      context: normalizePageContext({ ...context, route: context?.route || pathname }),
    };
    setRegistrations((current) => ({ ...current, [registrationId]: nextRegistration }));
    return registrationId;
  }, [pathname]);

  const unregisterContext = useCallback((registrationId) => {
    setRegistrations((current) => {
      if (!current[registrationId]) return current;
      const next = { ...current };
      delete next[registrationId];
      return next;
    });
  }, []);

  const pageContext = useMemo(() => {
    const active = Object.values(registrations).filter((item) => item.route === pathname);
    return active.length ? mergePageContexts(active, pathname) : { ...EMPTY_PAGE_CONTEXT, route: pathname };
  }, [pathname, registrations]);

  const value = useMemo(() => ({
    pageContext,
    registerContext,
    unregisterContext,
  }), [pageContext, registerContext, unregisterContext]);

  return <PageContextState.Provider value={value}>{children}</PageContextState.Provider>;
}

export function usePageContext() {
  const value = useContext(PageContextState);
  if (!value) throw new Error('usePageContext must be used inside PageContextProvider');
  return value;
}

export function usePageContextRegistration(sourceId, context, priority = 0) {
  const { registerContext, unregisterContext } = usePageContext();

  useEffect(() => {
    const registrationId = registerContext(sourceId, context, priority);
    return () => unregisterContext(registrationId);
  }, [context, priority, registerContext, sourceId, unregisterContext]);
}
