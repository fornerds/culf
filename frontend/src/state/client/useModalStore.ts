import { create } from 'zustand';

interface ModalState {
  isModalOpen: boolean;
  description?: string;
  pointDescription?: string;
  confirmButtonText?: string;
  onConfirm?: () => void;
  showModal: (
    description?: string,
    pointDescription?: string,
    confirmButtonText?: string,
    onConfirm?: () => void,
  ) => void;
  closeModal: () => void;
}

const useModalStore = create<ModalState>((set) => ({
  isModalOpen: false,
  description: undefined,
  pointDescription: undefined,
  confirmButtonText: '확인',
  onConfirm: undefined,
  showModal: (description, pointDescription, confirmButtonText, onConfirm) =>
    set({
      isModalOpen: true,
      description,
      pointDescription,
      confirmButtonText,
      onConfirm,
    }),
  closeModal: () =>
    set({
      isModalOpen: false,
      description: undefined,
      pointDescription: undefined,
      confirmButtonText: undefined,
      onConfirm: undefined,
    }),
}));

export default useModalStore;
