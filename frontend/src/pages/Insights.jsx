import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from 'recharts';
import { Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import VoiceButton from '../components/VoiceButton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import LoadDemoButton from '../components/LoadDemoButton.jsx';
import Badge, { SeverityBadge } from '../components/Badge.jsx';
import { SkeletonCards } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { askAnalytics, getInsights } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Insights() {
  const { t, lang } = useLanguage();
  const fmt = useFormat();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => getInsights({ language: lang }), [lang]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setQuestion(text);
    setAsking(true);
    try { setAnswer(await askAnalytics({ question: text, language: lang })); } catch (err) { toast.error(err.message); } finally { setAsking(false); }
  };

  if (loading) return <><PageHeader title={t('page.insights')} /><SkeletonCards count={2} /></>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (data.data_mode === 'empty') {
    return <><PageHeader title={t('page.insights')} subtitle={t('page.insights.sub')} /><Card><EmptyState illustration="chart" title={t('insights.empty.title')} body={t('insights.empty.body')}><LoadDemoButton onDone={reload} variant="primary" /></EmptyState></Card></>;
  }
  const cur = data.summary.currency;
  const monthly = data.monthly.map((m) => ({ ...m, label: fmt.month(m.month) }));

  return (
    <>
      <PageHeader title={t('page.insights')} subtitle={t('page.insights.sub')} actions={data.data_mode === 'demo' && <DemoBadge />} />
      <Card className="border-pilot-200 bg-pilot-50/40">
        <div className="flex items-center justify-between gap-2"><CardTitle>{t('insights.ai')}</CardTitle><Badge tone={data.ai_summary.generated_by === 'llm' ? 'violet' : 'neutral'}>{t(`common.generatedBy.${data.ai_summary.generated_by}`)}</Badge></div>
        <p className="mt-2 text-sm text-ink-700">{data.ai_summary.text}</p>
        <p className="mt-2 text-xs text-ink-500">{data.disclaimer}</p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card><CardTitle>{t('insights.monthly')}</CardTitle>
          <div className="mt-3 h-56" role="img" aria-label={t('insights.monthly')}><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ left: -10, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7ec" /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} />
            <ChartTip formatter={(v) => fmt.money(v, cur)} /><Line type="monotone" dataKey="received" stroke="#6d5ef5" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
        </Card>
        <Card><CardTitle>{t('insights.categories')}</CardTitle>
          {data.categories.length === 0 ? <p className="py-6 text-sm text-ink-500">{t('insights.empty.body')}</p> : (
            <div className="mt-3 h-56" role="img" aria-label={t('insights.categories')}><ResponsiveContainer width="100%" height="100%"><BarChart data={data.categories} layout="vertical" margin={{ left: 20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e7ec" /><XAxis type="number" tickLine={false} axisLine={false} fontSize={12} /><YAxis type="category" dataKey="category" width={120} tickLine={false} axisLine={false} fontSize={11} />
              <ChartTip formatter={(v) => fmt.money(v, cur)} /><Bar dataKey="total" fill="#3b82f6" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>)}
        </Card>
      </div>

      <Card className="mt-4"><CardTitle>{t('insights.patterns')}</CardTitle>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
          <thead><tr className="table-head"><th>{t('common.customer')}</th><th className="text-right">{t('common.count')}</th><th className="text-right">{t('common.total')}</th><th className="text-right">{t('insights.average')}</th><th className="text-right">{t('insights.lastPayment')}</th></tr></thead>
          <tbody>{data.customer_patterns.map((p) => <tr key={p.name} className="border-t border-ink-100"><td className="py-2">{p.name}</td><td className="text-right">{p.count}</td><td className="text-right">{fmt.money(p.total, cur)}</td><td className="text-right">{fmt.money(p.average, cur)}</td><td className="text-right">{p.last_payment ? fmt.date(p.last_payment) : '—'}</td></tr>)}</tbody>
        </table></div>
      </Card>

      <Card className="mt-4"><CardTitle>{t('insights.alerts')}</CardTitle>
        {data.alerts.length === 0 ? <p className="py-4 text-sm text-ink-500">{t('insights.noAlerts')}</p> : <ul className="mt-2 space-y-2">{data.alerts.slice(0, 5).map((a) => <li key={a.id} className="rounded-xl border border-ink-100 p-3 text-sm"><SeverityBadge severity={a.severity} /> <b>{a.title}</b><p className="mt-1 text-xs text-ink-600">{a.explanation}</p></li>)}</ul>}
      </Card>

      <Card className="mt-4"><CardTitle>{t('insights.ask.title')}</CardTitle>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input className="input flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('insights.ask.placeholder')} aria-label={t('insights.ask.title')} maxLength={500} />
          <VoiceButton onTranscript={(v) => ask(v)} />
          <Button type="submit" loading={asking} disabled={!question.trim()}><Sparkles className="h-4 w-4" aria-hidden="true" />{t('insights.ask.button')}</Button>
        </form>
        {answer && <div className="mt-3 rounded-xl bg-ink-50 p-4 text-sm"><p className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink-500">{t('insights.ask.answer')} <Badge tone={answer.generated_by === 'llm' ? 'violet' : 'neutral'}>{t(`common.generatedBy.${answer.generated_by}`)}</Badge>{answer.data_mode === 'demo' && <DemoBadge />}</p><p className="whitespace-pre-wrap">{answer.answer}</p><p className="mt-2 text-xs text-ink-500">{answer.disclaimer}</p></div>}
      </Card>
    </>
  );
}
