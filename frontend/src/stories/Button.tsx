// Button.tsx
import React from 'react';
import styles from './Button.module.css';
import PlusIcon from '@/assets/icons/plus.svg?react';

type ButtonSize = 'size1' | 'size2' | 'size3' | 'size4';
type ButtonVariant =
  | 'default'
  | 'plus_icon'
  | 'less-highlight'
  | 'warning'
  | 'disable';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  size = 'size1',
  variant = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  const buttonClass =
    `${styles.button} ${styles[size]} ${styles[variant]} ${className || ''}`.trim();

  return (
    <button className={buttonClass} {...props}>
      {variant === 'plus_icon' && <PlusIcon />}
      {children}
    </button>
  );
}

export default Button;
