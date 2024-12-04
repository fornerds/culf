import React, { useState, useRef, useEffect, MouseEventHandler } from 'react';
import styles from './Input.module.css';

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  id?: string;
  className?: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
  onChange?: (value: string) => void;
  onChangeObj?: (id: string, value: string) => void;
  onBlur?: () => void;
}

export function Input({
  id,
  className,
  disabled,
  type = 'text',
  value: propValue,
  onChange,
  onChangeObj,
  onBlur,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (propValue !== undefined) {
      setInputValue(propValue.toString());
    }
  }, [propValue]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value: newValue } = e.target;
    if (id === 'birthDate') {
      const rawValue = newValue.replace(/\D/g, ''); // 숫자 이외의 문자 제거
      let formattedDate = rawValue;

      if (rawValue.length > 4) {
        formattedDate = `${rawValue.slice(0, 4)}-${rawValue.slice(4)}`;
      }
      if (rawValue.length > 6) {
        formattedDate = `${rawValue.slice(0, 4)}-${rawValue.slice(4, 6)}-${rawValue.slice(6)}`;
      }
      setInputValue(formattedDate);
    } else {
      setInputValue(newValue);
    }

    if (onChange) {
      onChange(newValue);
    }
    if (onChangeObj) {
      onChangeObj(id, newValue);
    }
  };

  const clearInput: MouseEventHandler<HTMLButtonElement> = (e) => {
    const target = e.target as HTMLButtonElement;
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    if (onChange) {
      onChange('');
    }
    if (onChangeObj) {
      onChangeObj(target.id, '');
    }
  };

  const inputClass = `
    ${styles.input}
    ${isFocused ? styles.focused : ''}
    ${inputValue ? styles.hasValue : ''}
    ${disabled ? styles.disabled : ''}
    ${className || ''}
  `.trim();

  return (
    <div className={styles.inputWrapper}>
      <div className={inputClass}>
        <input
          id={id}
          ref={inputRef}
          {...props}
          type={type}
          value={inputValue}
          className={styles.inputElement}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          disabled={disabled}
        />
        {inputValue && !disabled && type !== 'password' && (
          <button
            id={id}
            type="button"
            className={styles.clearButton}
            onClick={clearInput}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
