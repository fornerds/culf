import React, { ReactNode, AnchorHTMLAttributes } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import styles from './Link.module.css'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode
  to: string
  underline?: boolean
  className?: string
}

export function Link({
  children,
  to,
  underline = false,
  className = '',
  ...props
}: LinkProps) {
  const linkClass = `${styles.link} ${
    underline ? styles.underline : ''
  } ${className}`

  // 외부 링크 체크 (http 또는 https로 시작하는 경우)
  const isExternalLink = /^https?:\/\//i.test(to)

  if (isExternalLink) {
    return (
      <a 
        href={to} 
        className={linkClass} 
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    )
  }

  return (
    <RouterLink to={to} className={linkClass} {...props}>
      {children}
    </RouterLink>
  )
}