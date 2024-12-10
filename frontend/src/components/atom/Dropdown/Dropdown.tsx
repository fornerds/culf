import { ForwardedRef, useEffect, useRef, useState } from 'react';
import styles from './Dropdown.module.css';
import DropdownIcon from '@/assets/icons/dropdown.svg?react';
import useClickOutside from '@/hooks/ui/useClickOutside';

export type SelectOption = { optionValue: string; optionLabel: string };

export interface DropdownProps {
  id: string;
  selectOption: SelectOption[];
  onChange: ({ optionValue, optionLabel }: SelectOption) => void;
  value: SelectOption;
}

export function Dropdown(
  { id, selectOption, value, onChange }: DropdownProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const [expanded, setExpanded] = useState(false);
  const handleExpand = () => {
    setExpanded(!expanded);
  };
  const handleChangeValue = ({ optionValue, optionLabel }: SelectOption) => {
    onChange({ optionValue, optionLabel });
    setExpanded(false);
  };

  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref) {
      ref = selectRef;
    }
  }, [selectRef]);

  useClickOutside(selectRef, () => setExpanded(false));
  return (
    <div className={styles.dropdownContainer}>
      <div
        className={`${styles.dropdown} ${expanded && styles.expanded}`}
        ref={selectRef}
      >
        <div className={styles.dropdownLabelArea} onClick={handleExpand}>
          <button
            type="button"
            className={`font-text-2 ${styles.dropdownLabel}`}
            id={id}
          >
            {value.optionLabel}
          </button>
          <div className={styles.dropdownButton}>
            <DropdownIcon className={styles.dropdownIcon} />
          </div>
        </div>
        <ul className={styles.dropdownOption}>
          {selectOption.map(({ optionValue, optionLabel }) => (
            <li key={optionValue}>
              <button
                type="button"
                className={`font-text-3 ${styles.button} ${optionLabel === value.optionLabel && styles.selected}`}
                onClick={() => handleChangeValue({ optionValue, optionLabel })}
              >
                {optionLabel}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
