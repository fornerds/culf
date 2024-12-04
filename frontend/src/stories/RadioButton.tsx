import { InputHTMLAttributes } from 'react';
import styles from './RadioButton.module.css';

export interface RadioButtonProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'css'> {
  label?: string;
}

export function RadioButton({
  value,
  checked,
  label = '',
  id,
  ...rest
}: RadioButtonProps) {
  return (
    <span className={`${styles.radioButton} ${checked && styles.checked}`}>
      <input
        className={styles.radioInput}
        type="radio"
        id={id}
        value={value}
        checked={checked}
        {...rest}
      />
      <label htmlFor={id} className={`${styles.label} font-text-2`}>
        {label}
      </label>
    </span>
  );
}

export default RadioButton;
