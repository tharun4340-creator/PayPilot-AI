import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import LoadDemoButton from '../components/LoadDemoButton.jsx';
import { removeDemoData } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSystem } from '../context/SystemContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { LANGUAGES } from '../i18n/index.js';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { t, lang, setLanguage } = useLanguage();
  const { mode, llmConfigured, status, defaultCurrency } = useSystem();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: user.full_name, business_name: user.business_name || '' });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error(t('auth.err.name'));
    setSaving(true);
    try { await updateUser({ full_name: form.full_name.trim(), business_name: form.business_name.trim() }); toast.success(t('settings.saved')); } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  const remove = async () => {
    setRemoving(true);
    try { await removeDemoData(); toast.success(t('settings.demo.removed')); setConfirm(false); } catch (err) { toast.error(err.message); } finally { setRemoving(false); }
  };

  return (
    <>
      <PageHeader title={t('page.settings')} subtitle={t('page.settings.sub')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>{t('settings.profile')}</CardTitle>
          <form onSubmit={save} className="mt-3 space-y-3">
            <Field label={t('common.email')}><input className="input" value={user.email} disabled /></Field>
            <Field label={t('settings.fullName')}><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={120} /></Field>
            <Field label={t('settings.businessName')} optional><input className="input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} maxLength={160} /></Field>
            <Field label={t('settings.language')}><select className="input" value={lang} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></Field>
            <Button type="submit" loading={saving}>{t('common.save')}</Button>
          </form>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>{t('settings.system')}</CardTitle>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">{t('settings.paypalMode')}</dt><dd><Badge tone={mode === 'demo' ? 'warning' : mode === 'live' ? 'danger' : 'info'}>{mode ? t(`settings.mode.${mode}`) : '—'}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">{t('settings.ai')}</dt><dd><Badge tone={llmConfigured ? 'success' : 'neutral'}>{llmConfigured ? t('settings.ai.on') : t('settings.ai.off')}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">{t('settings.defaultCurrency')}</dt><dd className="font-medium">{defaultCurrency}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Webhook</dt><dd className="font-medium">{status?.webhook_configured ? '✓' : '—'}</dd></div>
            </dl>
            {(mode === 'demo' || !llmConfigured) && <p className="mt-3 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">{t('settings.configure')}</p>}
            {llmConfigured && status?.llm_provider === 'google' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Gemini's free tier may use submitted prompts to improve Google products. PayPilot sends the data needed to answer your request, which can include customer names and payment details. Use labeled demo records for hackathon demos and avoid sending real customer data. <a className="font-semibold underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Google AI terms</a></p>}
          </Card>
          <Card>
            <CardTitle>{t('settings.demo')}</CardTitle>
            <p className="mt-1 text-xs text-ink-500">{t('settings.demo.body')}</p>
            <div className="mt-3 flex flex-wrap gap-2"><LoadDemoButton label={t('settings.demo.load')} /><Button variant="secondary" onClick={() => setConfirm(true)}>{t('settings.demo.remove')}</Button></div>
          </Card>
          <Card>
            <CardTitle>{t('settings.account')}</CardTitle>
            <Button className="mt-3" variant="secondary" onClick={async () => { await logout(); navigate('/login'); }}>{t('nav.logout')}</Button>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={confirm} title={t('settings.demo.removeTitle')} confirmLabel={t('settings.demo.remove')} danger onConfirm={remove} onCancel={() => setConfirm(false)} loading={removing}><p className="text-sm text-ink-600">{t('settings.demo.removeBody')}</p></ConfirmDialog>
    </>
  );
}
