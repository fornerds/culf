import styles from './Checkbox.module.css';

export interface CheckboxProps {
  id: string;
  label: string;
  onChange: (value: string, checked: boolean) => void;
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
        onChange={(e) => onChange(e.target.value, e.target.checked)}
        {...rest}
      />
      <label htmlFor={id} className={styles.checkboxLabel}>
        {label}
      </label>
    </span>
  );
}

export default Checkbox;
