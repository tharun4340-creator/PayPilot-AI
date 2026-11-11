import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ExternalLink, History, Plus, Send, Wrench } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Button from '../components/Button.jsx';
import VoiceButton from '../components/VoiceButton.jsx';
import Badge, { StatusBadge } from '../components/Badge.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import CopyButton from '../components/CopyButton.jsx';
import Modal from '../components/Modal.jsx';
import { assistantChat, cancelAssistantAction, confirmAssistantAction, getConversation, getConversations } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useSystem } from '../context/SystemContext.jsx';
import useFormat from '../hooks/useFormat.js';
import { matchNavigation } from '../utils/voiceNav.js';
import { newIdempotencyKey } from '../utils/format.js';

function ResultCard({ data }) {
  const { t } = useLanguage();
  const fmt = useFormat();
  if (!data) return null;
  const demo = data.data_mode === 'demo' && <DemoBadge />;
  if (data.type === 'payments') {
    if (!data.items?.length) return <p className="mt-2 text-xs text-ink-500">{t('assistant.result.none')}</p>;
    return (
      <div className="mt-3 rounded-xl border border-ink-100 bg-white p-3">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink-500">{t('assistant.result.payments')} {demo}</p>
        <ul className="divide-y divide-ink-100">
          {data.items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">{p.customer_name} <span className="text-xs text-ink-400">· {p.description}</span></span>
              <span className="flex shrink-0 items-center gap-2"><b>{fmt.money(p.amount, p.currency)}</b><StatusBadge status={p.status} /></span>
            </li>
          ))}
        </ul>
        {data.hints?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-ink-600">{data.hints.map((h) => <li key={h}>{h}</li>)}</ul>}
      </div>
    );
  }
  if (data.type === 'customers') {
    return (
      <div className="mt-3 rounded-xl border border-ink-100 bg-white p-3">
        <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink-500">{t('assistant.result.customers')} {demo}</p>
        <ul className="divide-y divide-ink-100">
          {data.items.map((c) => <li key={c.name} className="flex justify-between py-2 text-sm"><span>{c.name}</span><b>{fmt.money(c.total, data.currency)}</b></li>)}
        </ul>
      </div>
    );
  }
  if (data.type === 'summary' || data.type === 'report') {
    const tt = data.totals;
    return (
      <div className="mt-3 rounded-xl border border-ink-100 bg-white p-3 text-sm">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-500">{t(`assistant.result.${data.type}`)} · {fmt.month(data.month)} {demo}</p>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-ink-500">{t('dash.received')}</dt><dd className="text-right font-semibold">{fmt.money(tt.received, tt.currency)}</dd>
          <dt className="text-ink-500">{t('dash.pending')}</dt><dd className="text-right font-semibold">{fmt.money(tt.pending_amount, tt.currency)}</dd>
          <dt className="text-ink-500">{t('dash.completed')}</dt><dd className="text-right font-semibold">{tt.completed_count}</dd>
        </dl>
        {data.text && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-ink-600">{data.text}</pre>}
      </div>
    );
  }
  return null;
}

function PendingCard({ action, onChange }) {
  const { t } = useLanguage();
  const fmt = useFormat();
  const toast = useToast();
  const { mode } = useSystem();
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const key = useRef(newIdempotencyKey());
  const p = action.payload;

  const confirm = async () => {
    setBusy('confirm');
    try {
      const res = await confirmAssistantAction(action.id, { idempotency_key: key.current });
      setResult(res);
      onChange({ ...action, ...res.action });
      toast.success(t('assistant.pending.confirmed'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };
  const cancel = async () => {
    setBusy('cancel');
    try {
      const res = await cancelAssistantAction(action.id);
      onChange({ ...action, ...res.action });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const amount = p.amount ?? p.items?.[0]?.unit_price;
  return (
    <div className="mt-3 rounded-xl border border-pilot-200 bg-pilot-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-pilot-700">{t('assistant.pending.title')}</p>
      <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-500">{t('common.customer')}</dt><dd className="font-medium">{p.customer_name}</dd>
        <dt className="text-ink-500">{t('common.amount')}</dt><dd className="font-medium">{fmt.money(amount, p.currency)}</dd>
        <dt className="text-ink-500">{t('common.description')}</dt><dd>{p.description || p.items?.[0]?.description}</dd>
      </dl>
      {action.warnings?.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">{t('assistant.pending.warnings')}</p>
          <ul className="mt-1 list-disc pl-4">{action.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      {action.status === 'PENDING' && !result && (
        <>
          <p className="mt-3 text-xs text-ink-600">{t('assistant.safetyNote')}</p>
          {mode === 'demo' && <p className="mt-1 text-xs text-amber-700">{t('assistant.pending.demoNote')}</p>}
          <div className="mt-3 flex gap-2">
            <Button onClick={confirm} loading={busy === 'confirm'} disabled={Boolean(busy)}>{t('assistant.pending.confirm')}</Button>
            <Button variant="secondary" onClick={cancel} loading={busy === 'cancel'} disabled={Boolean(busy)}>{t('assistant.pending.cancel')}</Button>
          </div>
        </>
      )}
      {action.status === 'CANCELLED' && <p className="mt-3 text-sm text-ink-600">{t('assistant.pending.cancelled')}</p>}
      {(result || action.status === 'CONFIRMED') && (
        <div className="mt-3 text-sm">
          <Badge tone="success">{t('assistant.pending.confirmed')}</Badge>
          {result && <p className="mt-2 whitespace-pre-wrap text-ink-700">{result.message}</p>}
          {result?.payment?.approval_url && (
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="btn btn-primary btn-sm" href={result.payment.approval_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />{t('assistant.pending.openLink')}</a>
              <CopyButton text={result.payment.approval_url} label={t('assistant.pending.copyLink')} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Assistant() {
  const { t, lang } = useLanguage();
  const { llmConfigured } = useSystem();
  const toast = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [convId, setConvId] = useState(null);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottom = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  const send = async (raw) => {
    const message = (raw ?? text).trim();
    if (!message || busy) return;
    const dest = matchNavigation(message);
    if (dest) { toast.success(t('assistant.voice.navigating')); navigate(dest); return; }
    setText('');
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await assistantChat({ message, conversation_id: convId, language: lang });
      setConvId(res.conversation_id);
      setMessages((m) => [...m, res.reply]);
    } catch (err) {
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'assistant', content: err.message, mode: 'error' }]);
    } finally {
      setBusy(false);
    }
  };

  const updateAction = (msgId, action) => setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, pending_action: action } : x)));
  const openHistory = async () => {
    setShowHistory(true);
    try { setHistory(await getConversations()); } catch (err) { toast.error(err.message); }
  };
  const loadConversation = async (id) => {
    try {
      const c = await getConversation(id);
      setConvId(c.id); setMessages(c.messages); setShowHistory(false);
    } catch (err) { toast.error(err.message); }
  };
  const reset = () => { setMessages([]); setConvId(null); };
  const chips = [['assistant.chip.pending'], ['assistant.chip.summary'], ['assistant.chip.top'], ['assistant.chip.request'], ['assistant.chip.invoice']];

  return (
    <>
      <PageHeader title={t('page.assistant')} subtitle={t('page.assistant.sub')}
        actions={<><Button variant="secondary" size="sm" onClick={openHistory}><History className="h-4 w-4" aria-hidden="true" />{t('assistant.history')}</Button>
          <Button variant="secondary" size="sm" onClick={reset}><Plus className="h-4 w-4" aria-hidden="true" />{t('assistant.newChat')}</Button></>} />
      <div className="card flex h-[calc(100vh-15rem)] min-h-[420px] flex-col overflow-hidden p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md py-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pilot-50 text-pilot-600"><Bot className="h-6 w-6" aria-hidden="true" /></span>
              <h2 className="mt-3 font-semibold">{t('assistant.welcome.title')}</h2>
              <p className="mt-1 text-sm text-ink-500">{t('assistant.welcome.body')}</p>
              {!llmConfigured && <p className="mt-2 text-xs text-amber-700">{t('assistant.mode.demo')}</p>}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {chips.map(([k]) => <button key={k} type="button" className="rounded-full border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50" onClick={() => send(t(k))}>{t(k)}</button>)}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm sm:max-w-[80%] ${m.role === 'user' ? 'rounded-br-sm bg-ink-950 text-white' : 'rounded-bl-sm bg-ink-50 text-ink-900'}`}>
                {m.role === 'assistant' && m.mode && m.mode !== 'error' && (
                  <p className="mb-1"><Badge tone={m.mode === 'llm' ? 'violet' : 'warning'}>{m.mode === 'llm' ? t('assistant.mode.llm') : t('assistant.mode.demo')}</Badge></p>
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.tool_calls?.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1">{m.tool_calls.map((c, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-500"><Wrench className="h-3 w-3" aria-hidden="true" />{t('assistant.usedTool', { name: c.name })}</span>)}</p>
                )}
                <ResultCard data={m.data} />
                {m.pending_action && <PendingCard action={m.pending_action} onChange={(a) => updateAction(m.id, a)} />}
              </div>
            </div>
          ))}
          {busy && <p className="text-sm text-ink-400">{t('assistant.thinking')}</p>}
          <div ref={bottom} />
        </div>
        <form className="flex items-center gap-2 border-t border-ink-100 p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input flex-1" value={interim || text} onChange={(e) => setText(e.target.value)} placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')} maxLength={1000} />
          <VoiceButton onTranscript={(v) => send(v)} onInterim={setInterim} />
          <Button type="submit" disabled={!text.trim() || busy} aria-label={t('assistant.send')}><Send className="h-4 w-4" aria-hidden="true" /></Button>
        </form>
      </div>
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={t('assistant.history')}>
        {history.length === 0 ? <p className="text-sm text-ink-500">{t('assistant.noHistory')}</p> : (
          <ul className="divide-y divide-ink-100">{history.map((c) => <li key={c.id}><button type="button" className="w-full py-3 text-left text-sm hover:bg-ink-50" onClick={() => loadConversation(c.id)}>{c.title}</button></li>)}</ul>
        )}
      </Modal>
    </>
  );
}
