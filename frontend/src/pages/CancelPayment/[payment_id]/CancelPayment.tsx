import { useState, useRef, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { InputBox } from '@/components/molecule/InputBox';
import { Button, Label } from '@/components/atom';
import RemoveIcon from '@/assets/icons/remove.svg?react';
import styles from './CancelPayment.module.css';
import { payment } from '@/api';
import { Popup } from '@/components/molecule';

interface CancelPaymentForm {
  title: string;
  email: string;
  contact: string;
  content: string;
}

interface CancelResponse {
  inquiry_id: number;
  refund_id: number;
  payment_number: string;
  status: string;
  message: string;
}

export function CancelPayment() {
  const { payment_id } = useParams<{ payment_id: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [form, setForm] = useState<CancelPaymentForm>({
    title: '',
    email: '',
    contact: '',
    content: '',
  });

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const cancelPaymentMutation = useMutation<
    CancelResponse,
    Error,
    { paymentId: string; formData: FormData }
  >({
    mutationFn: async ({ paymentId, formData }) => {
      try {
        if (!paymentId) {
          throw new Error('결제 ID가 없습니다.');
        }

        const response = await payment.cancelPayment(paymentId, formData);
        return response.data;
      } catch (error: any) {
        console.error('Cancel payment error:', error);
        throw new Error(error.response?.data?.detail || '결제 취소 요청 중 오류가 발생했습니다.');
      }
    },
    onSuccess: () => {
      setShowSuccessPopup(true);
    },
  });

  const handleSuccessPopupClose = () => {
    setShowSuccessPopup(false);
    navigate('/');
  };

  const handleFormChange = (id: string, value: string) => {
    setForm(prev => ({
      ...prev,
      [id]: value,
    }));
    setError('');
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages = Array.from(files);
    const validImages = newImages.filter(file => {
      const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    if (validImages.length !== newImages.length) {
      setError('일부 파일이 지원되지 않는 형식이거나 10MB를 초과합니다.');
    }

    if (validImages.length > 0) {
      setSelectedImages(prev => [...prev, ...validImages]);
      const newUrls = validImages.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newUrls]);
    }
  };

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    if (!form.title.trim()) {
      setError('제목을 입력해주세요.');
      return false;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('올바른 이메일을 입력해주세요.');
      return false;
    }
    if (!form.contact.trim()) {
      setError('연락처를 입력해주세요.');
      return false;
    }
    if (!form.content.trim()) {
      setError('문의내용을 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !payment_id || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('email', form.email);
      formData.append('contact', form.contact);
      formData.append('content', form.content);
      
      selectedImages.forEach((file, index) => {
        formData.append('attachments', file);
      });

      await cancelPaymentMutation.mutateAsync({
        paymentId: payment_id,
        formData
      });
    } catch (error: any) {
      setError(error.message || '결제 취소 요청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.main}>
      <InputBox
        id="title"
        label="제목"
        placeholder="제목을 입력해주세요"
        value={form.title}
        onChangeObj={handleFormChange}
        error={error && !form.title ? error : ''}
      />
      <InputBox
        id="email"
        label="이메일"
        type="email"
        placeholder="이메일을 입력해주세요"
        value={form.email}
        onChangeObj={handleFormChange}
        error={error && !form.email ? error : ''}
      />
      <InputBox
        id="contact"
        label="연락처"
        placeholder="연락처를 입력해주세요"
        value={form.contact}
        onChangeObj={handleFormChange}
        error={error && !form.contact ? error : ''}
      />
      <div>
        <Label label="문의내용" id="content" />
        <textarea
          id="content"
          value={form.content}
          onChange={(e) => handleFormChange(e.target.id, e.target.value)}
          placeholder="문의내용을 입력해주세요"
          className={`${styles.textarea} font-guidetext`}
          maxLength={1000}
          rows={1}
        />
        <div className={`${styles.textareaLength} font-guidetext`}>
          {form.content.length}/1000
        </div>
      </div>

      <div className="font-text-2">
        사진을 첨부해주시면, 더욱 빠르고 정확한 도움을 드릴 수 있습니다.
        <br />
        (지원형식: jpg, jpeg, png, gif / 파일당 최대 10MB)
      </div>

      <input
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif"
        onChange={handleImageChange}
        multiple
        style={{ display: 'none' }}
        ref={inputRef}
      />

      <Button 
        size="size2" 
        variant="plus_icon" 
        onClick={() => inputRef.current?.click()}
      >
        사진 업로드
      </Button>

      {previewUrls.map((url, index) => (
        <div key={url} className={styles.selectedImageWrapper}>
          <img
            src={url}
            alt={`Selected ${index + 1}`}
            className={styles.selectedImage}
          />
          <button 
            onClick={() => handleRemoveImage(index)} 
            className={styles.removeBtn}
            type="button"
            aria-label="이미지 제거"
          >
            <RemoveIcon />
          </button>
        </div>
      ))}

      {error && (
        <div className={`${styles.errorMessage} font-guidetext`}>
          {error}
        </div>
      )}

      <Button 
        className={styles.bottomBtn} 
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? '처리중...' : '접수하기'}
      </Button>

      <Popup
        type="alert"
        isOpen={showSuccessPopup}
        onClose={handleSuccessPopupClose}
        content="해당 결제가 정상적으로 취소 요청되었습니다. 빠른 시일 내에 확인 후 이메일로 답변을 전달하도록 하겠습니다."
        confirmText="확인"
      />
    </main>
  );
}