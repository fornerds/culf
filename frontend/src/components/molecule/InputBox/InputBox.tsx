import React from 'react';
import styles from './InputBox.module.css';
import { Label } from '@/components/atom';
import { Input } from '@/components/atom';
import { ValidationMessage } from '@/components/atom';
import { Button } from '@/components/atom';
import { ButtonSize, ButtonVariant } from '@/components/atom/Button/Button';
import { ValidationMessageType } from '@/components/atom/ValidationMessage/ValidationMessage';

interface InputBoxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  id?: string;
  inputClassName?: string;
  disabled?: boolean;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
  label?: string;
  validationMessage?: string;
  validationMessageType?: ValidationMessageType;
  buttonSize?: ButtonSize;
  buttonVariant?: ButtonVariant;
  buttonClassName?: string;
  buttonText?: string;
  onChange?: (value: string) => void;
  onChangeObj?: (id: string, value: string) => void;
  onClick?: () => void;
}

export function InputBox({
  id,
  inputClassName,
  disabled,
  type = 'text',
  value: propValue,
  label,
  validationMessage,
  validationMessageType,
  buttonSize,
  buttonVariant,
  buttonClassName,
  buttonText,
  onChange,
  onChangeObj,
  onClick,
  ...props
}: InputBoxProps) {
  return (
    <div>
      {label && id && <Label label={label} id={id} />}
      <div className={styles.inputWithBtn}>
        <Input
          id={id}
          className={inputClassName}
          disabled={disabled}
          type={type}
          onChange={onChange}
          onChangeObj={onChangeObj}
          {...props}
        />
        {buttonText && (
          <Button
            size={buttonSize}
            variant={buttonVariant}
            className={`${styles.button} ${buttonClassName}`}
            onClick={onClick}
          >
            {buttonText}
          </Button>
        )}
      </div>
      {validationMessage && validationMessageType && (
        <ValidationMessage
          message={validationMessage}
          type={validationMessageType}
        />
      )}
    </div>
  );
}
