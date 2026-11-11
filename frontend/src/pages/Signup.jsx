import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { isValidEmail } from '../utils/format.js';

export default function Signup() {
  const { user, signup } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = t('auth.err.name');
    if (!isValidEmail(form.email)) errs.email = t('auth.err.email');
    if (form.password.length < 8) errs.password = t('auth.err.password');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setApiError('');
    try {
      await signup({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password });
      navigate('/app', { replace: true });
    } catch (err) {
      setApiError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 py-10">
      <div className="mb-6 flex w-full max-w-sm items-center justify-between">
        <Link to="/" aria-label={t('auth.backHome')}><Logo /></Link>
        <LanguageSwitcher />
      </div>
      <form onSubmit={submit} noValidate className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-xl font-bold text-ink-950">{t('auth.signup.title')}</h1>
          <p className="mt-1 text-sm text-ink-500">{t('auth.signup.subtitle')}</p>
        </div>
        {apiError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{apiError}</p>}
        <Field label={t('auth.fullName')} error={errors.full_name}>
          <input className="input" autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label={t('auth.email')} error={errors.email}>
          <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={errors.password}>
          <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button type="button" className="text-xs font-medium text-pilot-600" onClick={() => setShow(!show)}>{show ? t('auth.hidePassword') : t('auth.showPassword')}</button>
        <Button type="submit" loading={busy} className="w-full">{t('auth.signup')}</Button>
        <p className="text-center text-sm text-ink-500">{t('auth.haveAccount')} <Link to="/login" className="font-medium text-pilot-600">{t('auth.signin')}</Link></p>
      </form>
    </div>
  );
}
