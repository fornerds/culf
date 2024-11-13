import { ChangeEvent } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  id: string;
  label: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  checked: boolean;
}

export function Checkbox({
  id,
  label = '',
  checked = false,
  onChange,
  ...rest
}: CheckboxProps) {
  return (
    <span
      className={`${styles.checkboxContainer} ${checked && styles.checked}`}
    >
      <input
        type="checkbox"
        id={id}
        value={id}
        checked={checked}
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
