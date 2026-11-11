import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
  error = '',
}) {
  const { t } = useLanguage();
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel || t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel || t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-600">{children}</div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </Modal>
  );
}
