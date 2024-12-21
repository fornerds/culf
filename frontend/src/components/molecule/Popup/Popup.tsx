import React, { useState } from 'react';
import styles from './Popup.module.css';
import CloseIcon from '@/assets/icons/close.svg?react';
import { ValidationMessage } from '@/components/atom';
import { ValidationMessageType } from '@/components/atom/ValidationMessage/ValidationMessage';

interface BasePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConfirmPopupProps extends BasePopupProps {
  type: 'confirm';
  content: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface AlertPopupProps extends BasePopupProps {
  type: 'alert';
  email?: string;
  content: string;
  confirmText?: string;
}

interface ValidationState {
  message: string;
  type: ValidationMessageType;
}

interface FormPopupProps extends BasePopupProps {
  type: 'form';
  title: string;
  onSubmit: (data: FormData) => boolean;
  initialData?: FormData;
  submitText?: string;
  nameValidation?: ValidationState;
  emailValidation?: ValidationState;
}

type PopupProps = ConfirmPopupProps | AlertPopupProps | FormPopupProps;

interface FormData {
  name: string;
  email: string;
}

export function Popup(props: PopupProps) {
  const { isOpen, onClose } = props;

  if (!isOpen) return null;

  const renderContent = () => {
    switch (props.type) {
      case 'confirm':
        return (
          <div className={styles.popup}>
            <div className={`${styles.content} font-text-2`}>
              {props.content}
            </div>
            <div className={styles.buttons}>
              <button
                className={`${styles.button} ${styles.secondaryButton} font-text-4`}
                onClick={onClose}
              >
                {props.cancelText || '아니오'}
              </button>
              <button
                className={`${styles.button} ${styles.primaryButton} font-text-4`}
                onClick={() => {
                  props.onConfirm();
                  onClose();
                }}
              >
                {props.confirmText || '예'}
              </button>
            </div>
          </div>
        );

      case 'alert':
        return (
          <div className={styles.popup}>
            <div className={`${styles.content} font-title-3`}>
              {props.content} <p className={styles.strong}>{props?.email}</p>
            </div>
            <div className={styles.buttons}>
              <button
                className={`${styles.fullbutton} ${styles.primaryButton}`}
                onClick={onClose}
              >
                {props.confirmText || '확인'}
              </button>
            </div>
          </div>
        );

      case 'form':
        return <FormPopup {...props} />;
    }
  };

  return <div className={styles.overlay}>{renderContent()}</div>;
}

export function FormPopup({
  title,
  onSubmit,
  onClose,
  initialData,
  submitText = '확인',
  nameValidation,
  emailValidation,
}: FormPopupProps) {
  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || '',
    email: initialData?.email || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = onSubmit(formData);
    if (isValid) {
      onClose();
    }
  };

  return (
    <div className={styles.formpopup}>
      <div className={styles.header}>
        <h2 className={`${styles.title} font-title-3`}>{title}</h2>
        <button className={styles.closeButton} onClick={onClose}>
          <CloseIcon width="18" height="18" />
        </button>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={`${styles.label} font-text-4`}>이름</label>
          <input
            className={styles.input}
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="이름을 적어주세요"
          />
          {nameValidation && (
            <ValidationMessage
              message={nameValidation.message}
              type={nameValidation.type}
            />
          )}
        </div>
        <div className={styles.formGroup}>
          <label className={`${styles.label} font-text-4`}>이메일</label>
          <input
            className={styles.input}
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="example@gmail.com"
          />
          {emailValidation && (
            <ValidationMessage
              message={emailValidation.message}
              type={emailValidation.type}
            />
          )}
        </div>
        <div className={styles.buttons}>
          <button
            type="submit"
            className={`${styles.formfullbutton} ${styles.primaryButton} font-text-4`}
          >
            {submitText}
          </button>
        </div>
      </form>
    </div>
  );
}
