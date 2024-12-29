import { useState, useRef, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { InputBox } from '@/components/molecule/InputBox';
import { Button, Label } from '@/components/atom';
import RemoveIcon from '@/assets/icons/remove.svg?react';
import styles from './CancelPayment.module.css';
import { payment } from '@/api';

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
  const [form, setForm] = useState<CancelPaymentForm>({
    title: '',
    email: '',
    contact: '',
    content: '',
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cancelPaymentMutation = useMutation<
    CancelResponse, // 성공 응답 타입
    Error,         // 에러 타입
    { paymentId: string; formData: FormData; }
  >({
    mutationFn: async ({ paymentId, formData }) => {
      try {
        if (!paymentId) {
          throw new Error('결제 ID가 없습니다.');
        }

        const jsonData = {
          title: formData.get('title') as string,
          email: formData.get('email') as string,
          contact: formData.get('contact') as string,
          content: formData.get('content') as string,
          attachment: formData.get('attachment') as string || ''
        };

        console.log('Sending cancel payment request:', jsonData);
        const response = await payment.cancelPayment(paymentId, jsonData);
        return response.data;
      } catch (error: any) {
        console.error('Cancel payment error:', error);
        throw new Error(error.response?.data?.detail || '결제 취소 요청 중 오류가 발생했습니다.');
      }
    },
    onSuccess: () => {
      navigate('/mypage/payments');
    },
  });

  const handleFormChange = (id: string, value: string) => {
    setForm(prev => ({
      ...prev,
      [id]: value,
    }));
    setError('');
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (e.g., 5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('파일 크기는 5MB 이하여야 합니다.');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.');
        return;
      }

      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleRemoveImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImage(null);
    setPreviewUrl(null);
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
      let attachmentUrl = '';

      if (selectedImage) {
        try {
          const imageFormData = new FormData();
          imageFormData.append('file', selectedImage);
          
          const uploadResponse = await payment.uploadImage(selectedImage);
          attachmentUrl = uploadResponse.data.url;
        } catch (error) {
          console.error('Image upload failed:', error);
          setError('이미지 업로드에 실패했습니다.');
          setIsSubmitting(false);
          return;
        }
      }

      // FormData 생성
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('email', form.email);
      formData.append('contact', form.contact);
      formData.append('content', form.content);
      formData.append('attachment', attachmentUrl);

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
      
      {error && (
        <div className={`${styles.errorMessage} font-guidetext`}>
          {error}
        </div>
      )}

      <div className="font-text-2">
        사진을 첨부해주시면, 더욱 빠르고 정확한 도움을 드릴 수 있습니다.
      </div>

      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
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

      {previewUrl && (
        <div className={styles.selectedImageWrapper}>
          <img
            src={previewUrl}
            alt="Selected"
            className={styles.selectedImage}
          />
          <button 
            onClick={handleRemoveImage} 
            className={styles.removeBtn}
            type="button"
            aria-label="이미지 제거"
          >
            <RemoveIcon />
          </button>
        </div>
      )}

      <Button 
        className={styles.bottomBtn} 
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? '처리중...' : '접수하기'}
      </Button>
    </main>
  );
}