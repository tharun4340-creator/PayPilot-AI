import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Spinner from './components/Spinner.jsx';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Signup = lazy(() => import('./pages/Signup.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Wallet = lazy(() => import('./pages/Wallet.jsx'));
const Assistant = lazy(() => import('./pages/Assistant.jsx'));
const Payments = lazy(() => import('./pages/Payments.jsx'));
const PaySeller = lazy(() => import('./pages/PaySeller.jsx'));
const PaymentNew = lazy(() => import('./pages/PaymentNew.jsx'));
const PaymentDetail = lazy(() => import('./pages/PaymentDetail.jsx'));
const PaymentReturn = lazy(() => import('./pages/PaymentReturn.jsx'));
const PaymentCancelled = lazy(() => import('./pages/PaymentCancelled.jsx'));
const Invoices = lazy(() => import('./pages/Invoices.jsx'));
const InvoiceNew = lazy(() => import('./pages/InvoiceNew.jsx'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Safety = lazy(() => import('./pages/Safety.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Spinner className="min-h-screen" />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/wallet" element={<Wallet />} />
            <Route path="/app/assistant" element={<Assistant />} />
            <Route path="/app/payments" element={<Payments />} />
            <Route path="/app/pay-seller" element={<PaySeller />} />
            <Route path="/app/payments/new" element={<PaymentNew />} />
            <Route path="/app/payments/:id" element={<PaymentDetail />} />
            <Route path="/app/invoices" element={<Invoices />} />
            <Route path="/app/invoices/new" element={<InvoiceNew />} />
            <Route path="/app/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/app/customers" element={<Customers />} />
            <Route path="/app/customers/:id" element={<CustomerDetail />} />
            <Route path="/app/insights" element={<Insights />} />
            <Route path="/app/safety" element={<Safety />} />
            <Route path="/app/reports" element={<Reports />} />
            <Route path="/app/settings" element={<Settings />} />
            <Route path="/payments/return" element={<PaymentReturn />} />
            <Route path="/payments/cancelled" element={<PaymentCancelled />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
