import { ChangeEvent } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  id: string;
  value: string;
  label: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  checked: boolean;
  disabled?: boolean;
}
export function Checkbox({
  id,
  value,
  label = '',
  checked = false,
  disabled = false,
  onChange,
  ...rest
}: CheckboxProps) {
  return (
    <span
      className={`${styles.checkboxContainer} ${checked ? styles.checked : ''} ${
        disabled ? styles.disabled : ''
      }`}
    >
      <input
        type="checkbox"
        id={id}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        {...rest}
      />
      <label htmlFor={id} className={styles.checkboxLabel}>
        {label}
      </label>
    </span>
  );
}

export default Checkbox;
