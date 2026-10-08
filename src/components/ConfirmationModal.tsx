import React from 'react';
import Modal from './Modal';
import { useT } from '@/i18n/LanguageContext';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE = {
  danger: { icon: 'warning', iconClass: 'bg-red-50 text-red-600', submitVariant: 'danger' as const },
  warning: { icon: 'report', iconClass: 'bg-amber-50 text-amber-600', submitVariant: 'warning' as const },
  info: { icon: 'info', iconClass: 'bg-blue-50 text-blue-600', submitVariant: 'primary' as const },
};

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  type = 'info',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const t = useT();
  const style = TYPE[type];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      elevated
      dismissOnBackdrop
      submitLabel={confirmLabel ?? t('Konfirmasi')}
      cancelLabel={cancelLabel ?? t('Batal')}
      submitVariant={style.submitVariant}
      onConfirm={onConfirm}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconClass}`}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{style.icon}</span>
        </span>
        <p className="pt-1 text-sm leading-relaxed text-slate-600">{message}</p>
      </div>
    </Modal>
  );
}
