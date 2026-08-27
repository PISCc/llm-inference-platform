import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePageContext } from './PageContext.jsx';
import { streamAgent } from '../modules/agent/agentClient.js';
import { buildLocalKnowledgeAnswer } from '../modules/agent/localKnowledge.js';

const STORAGE_KEY = 'llm-inference-agent-session-v1';
const AgentSessionState = createContext(null);

function loadTurns() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.slice(-8) : [];
  } catch {
    return [];
  }
}

export function AgentSessionProvider({ children }) {
  const { pageContext } = usePageContext();
  const [turns, setTurns] = useState(loadTurns);
  const [activeTurnId, setActiveTurnId] = useState(() => loadTurns().at(-1)?.id || null);
  const [isOpen, setIsOpen] = useState(false);
  const turnsRef = useRef(turns);
  const abortRef = useRef(null);

  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-8)));
    } catch {
      // Session persistence is optional; the in-memory conversation remains available.
    }
  }, [turns]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateTurn = useCallback((id, patch) => {
    setTurns((current) => current.map((turn) => (
      turn.id === id ? { ...turn, ...(typeof patch === 'function' ? patch(turn) : patch) } : turn
    )));
  }, []);

  const applyLocalFallback = useCallback((id, query, context, reason = '') => {
    const local = buildLocalKnowledgeAnswer(query, context);
    updateTurn(id, {
      answer: local.answer,
      meta: local.meta,
      error: reason,
      status: 'fallback',
    });
  }, [updateTurn]);

  const ask = useCallback(async (rawQuery, options = {}) => {
    const query = String(rawQuery || '').trim();
    if (!query) return null;

    abortRef.current?.abort();
    setTurns((current) => current.map((turn) => (
      ['connecting', 'streaming'].includes(turn.status) ? { ...turn, status: 'stopped' } : turn
    )));

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const context = options.pageContext || pageContext;
    const previousConversation = turnsRef.current
      .filter((turn) => turn.answer && !['connecting', 'streaming'].includes(turn.status))
      .flatMap((turn) => [
        { role: 'user', content: turn.query },
        { role: 'assistant', content: turn.answer },
      ])
      .slice(-8);
    const nextTurn = {
      id,
      query,
      answer: '',
      meta: null,
      error: '',
      status: 'connecting',
      pageId: context.pageId || '',
      pageTitle: context.pageTitle || '当前页面',
      createdAt: Date.now(),
    };
    setTurns((current) => [...current, nextTurn].slice(-8));
    setActiveTurnId(id);

    const controller = new AbortController();
    abortRef.current = controller;
    let answerBuffer = '';
    let receivedError = '';
    let terminalStatus = 'connecting';
    try {
      await streamAgent({ query, pageContext: context, conversation: previousConversation }, {
        signal: controller.signal,
        onEvent: ({ event, data }) => {
          if (event === 'context') {
            terminalStatus = data.mode === 'model' ? 'streaming' : 'fallback';
            updateTurn(id, { meta: data, status: data.mode === 'model' ? 'streaming' : 'fallback' });
          }
          if (event === 'delta') {
            answerBuffer += data.text || '';
            terminalStatus = 'streaming';
            updateTurn(id, { answer: answerBuffer, status: 'streaming' });
          }
          if (event === 'warning') {
            updateTurn(id, { error: data.message || '模型回答已切换到本地知识。' });
          }
          if (event === 'error') {
            receivedError = data.message || '智能体服务暂时不可用。';
            terminalStatus = 'error';
            updateTurn(id, { error: receivedError, status: 'error' });
          }
          if (event === 'done') {
            terminalStatus = data.mode === 'model' ? 'done' : 'fallback';
            updateTurn(id, { status: data.mode === 'model' ? 'done' : 'fallback' });
          }
        },
      });
      if (!answerBuffer.trim()) {
        applyLocalFallback(id, query, context, receivedError);
      } else if (terminalStatus === 'connecting' || terminalStatus === 'streaming') {
        // 服务端关闭了流但没有发送 done 事件，避免 turn 永远停在“正在回答”。
        updateTurn(id, { status: 'done' });
      }
    } catch (error) {
      if (controller.signal.aborted) return id;
      applyLocalFallback(id, query, context, error.message || '无法连接智能体服务。');
    }
    return id;
  }, [applyLocalFallback, pageContext, updateTurn]);

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setActiveTurnId(null);
  }, []);

  const activeTurn = useMemo(
    () => (activeTurnId ? turns.find((turn) => turn.id === activeTurnId) || null : null),
    [activeTurnId, turns],
  );

  const value = useMemo(() => ({
    turns,
    activeTurn,
    activeTurnId,
    isOpen,
    setIsOpen,
    ask,
    selectTurn: setActiveTurnId,
    clearActive: () => setActiveTurnId(null),
    clearConversation,
  }), [activeTurn, activeTurnId, ask, clearConversation, isOpen, turns]);

  return <AgentSessionState.Provider value={value}>{children}</AgentSessionState.Provider>;
}

export function useAgentSession() {
  const value = useContext(AgentSessionState);
  if (!value) throw new Error('useAgentSession must be used inside AgentSessionProvider');
  return value;
}
