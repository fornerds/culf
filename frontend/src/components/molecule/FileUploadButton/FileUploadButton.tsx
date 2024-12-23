import React from 'react';
import styles from './FileUploadButton.module.css';
import FileUploadButtonIcon from '@/assets/icons/file-upload-button.svg?react';

interface FileUploadButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function FileUploadButton({ isOpen, onToggle }: FileUploadButtonProps) {
  return (
    <button
      className={`${styles.uploadButton} ${isOpen ? styles.open : ''}`}
      onClick={onToggle}
    >
      <FileUploadButtonIcon />
    </button>
  );
}
