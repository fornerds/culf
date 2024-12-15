import { Button } from '@/components/atom';
import styles from './Modal.module.css';

interface ModalProps {
  isModalOpen: boolean;
  closeModal: () => void;
  description?: string;
  pointDescription?: string;
  confirmButtonText?: string;
  onConfirm?: () => void;
}

export function Modal({
  isModalOpen,
  closeModal,
  description,
  pointDescription,
  confirmButtonText = '확인',
  onConfirm,
}: ModalProps) {
  if (!isModalOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeModal();
  };

  return (
    <>
      <div className={styles.overlay} onClick={closeModal}></div>
      <div className={styles.modal} onClick={closeModal}>
        <div
          className={styles.modalContainer}
          onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 시 닫힘 방지
        >
          <div className={styles.content}>
            {description && (
              <div className={styles.description}>{description}</div>
            )}
            {pointDescription && (
              <div className={styles.pointDescription}>{pointDescription}</div>
            )}
          </div>
          <Button size="size2" onClick={handleConfirm}>
            {confirmButtonText}
          </Button>
        </div>
      </div>
    </>
  );
}
