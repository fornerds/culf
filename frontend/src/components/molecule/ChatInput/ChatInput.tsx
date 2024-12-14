import React, {
  useState,
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useEffect,
} from 'react';
import styles from './ChatInput.module.css';
import ButtonIcon from '@/assets/icons/button.svg?react';
import ButtonDisabledIcon from '@/assets/icons/button-disabled.svg?react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  hasImage?: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, hasImage = false, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialHeight = useRef<number>(0);

  useEffect(() => {
    if (textareaRef.current) {
      initialHeight.current = textareaRef.current.scrollHeight;
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight(e.target);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((message.trim() || hasImage) && !isComposing && !disabled) {
      onSendMessage(message);
      setMessage('');
      adjustTextareaHeight(textareaRef.current);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
    }
  };

  const adjustTextareaHeight = (element: HTMLTextAreaElement | null) => {
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    }
  };

  const isButtonActive = (message.trim() || hasImage) && !disabled;

  return (
    <form className={styles.chatInput} onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder="무엇이 궁금하신가요?"
        className={`${styles.input} font-text-2`}
        rows={1}
        disabled={disabled}
      />
      <button
        type="submit"
        className={`${styles.button} ${isButtonActive ? styles.active : ''}`}
        disabled={!isButtonActive || isComposing}
      >
        {isButtonActive ? <ButtonIcon /> : <ButtonDisabledIcon />}
      </button>
    </form>
  );
}