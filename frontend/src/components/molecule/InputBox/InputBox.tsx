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
  inputDisabled?: boolean;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
  label?: string;
  validationMessage?: string;
  validationMessageType?: ValidationMessageType;
  buttonSize?: ButtonSize;
  buttonVariant?: ButtonVariant;
  buttonClassName?: string;
  buttonDisabled?: boolean;
  buttonText?: string;
  onChange?: (value: string) => void;
  onChangeObj?: (id: string, value: string) => void;
  onClick?: () => void;
  onBlur?: () => void;
}

export function InputBox({
  id,
  inputClassName,
  inputDisabled,
  type = 'text',
  value: propValue,
  label,
  validationMessage,
  validationMessageType,
  buttonSize,
  buttonVariant,
  buttonClassName,
  buttonDisabled,
  buttonText,
  onChange,
  onChangeObj,
  onClick,
  onBlur,
  ...props
}: InputBoxProps) {
  return (
    <div>
      {label && id && <Label label={label} id={id} />}
      <div className={styles.inputWithBtn}>
        <Input
          id={id}
          className={inputClassName}
          disabled={inputDisabled}
          type={type}
          value={propValue}
          onChange={onChange}
          onChangeObj={onChangeObj}
          onBlur={onBlur}
          {...props}
        />
        {buttonText && (
          <Button
            size={buttonSize}
            variant={buttonVariant}
            className={`${styles.button} ${buttonClassName}`}
            disabled={buttonDisabled}
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
