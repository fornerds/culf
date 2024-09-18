import React from 'react';
import styles from './InputBox.module.css';
import { Label } from '../Label';
import { Input } from '../Input/Input';
import { ValidationMessage } from '../ValidationMessage';
import { Button } from '../Button';
import { ButtonSize, ButtonVariant } from '../Button/Button';
import { ValidationMessageType } from '../ValidationMessage/ValidationMessage';

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
          {...props}
        />
        {buttonText && (
          <Button
            size={buttonSize}
            variant={buttonVariant}
            className={`${styles.button} ${buttonClassName}`}
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
