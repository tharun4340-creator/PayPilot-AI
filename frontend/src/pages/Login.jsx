import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { isValidEmail } from '../utils/format.js';

export default function Login() {
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  if (user) return <Navigate to={location.state?.from?.pathname || '/app'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isValidEmail(form.email)) errs.email = t('auth.err.email');
    if (!form.password) errs.password = t('auth.err.passwordRequired');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setApiError('');
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from?.pathname || '/app', { replace: true });
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
          <h1 className="text-xl font-bold text-ink-950">{t('auth.signin.title')}</h1>
          <p className="mt-1 text-sm text-ink-500">{t('auth.signin.subtitle')}</p>
        </div>
        {apiError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{apiError}</p>}
        <Field label={t('auth.email')} error={errors.email}>
          <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t('auth.password')} error={errors.password}>
          <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button type="button" className="text-xs font-medium text-pilot-600" onClick={() => setShow(!show)}>{show ? t('auth.hidePassword') : t('auth.showPassword')}</button>
        <Button type="submit" loading={busy} className="w-full">{t('auth.signin')}</Button>
        <p className="text-center text-sm text-ink-500">{t('auth.noAccount')} <Link to="/signup" className="font-medium text-pilot-600">{t('auth.signup')}</Link></p>
      </form>
    </div>
  );
}
