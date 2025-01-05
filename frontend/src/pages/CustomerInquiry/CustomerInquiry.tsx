import { Button, Label } from '@/components/atom';
import styles from './CustomerInquiry.module.css';
import { InputBox } from '@/components/molecule/InputBox';
import RemoveIcon from '@/assets/icons/remove.svg?react';
import { ChangeEvent, useRef, useState } from 'react';
import { inquiry } from '@/api';

export function CustomerInquiry() {
  const [form, setForm] = useState({
    title: '',
    email: '',
    phoneNumber: '',
    content: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFormChange = (id: string, value: string) => {
    setForm({
      ...form,
      [id]: value,
    });
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

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const validateForm = () => {
    if (!form.title.trim()) return '제목을 입력해주세요.';
    if (!form.email.trim()) return '이메일을 입력해주세요.';
    if (!form.phoneNumber.trim()) return '연락처를 입력해주세요.';
    if (!form.content.trim()) return '문의내용을 입력해주세요.';
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('email', form.email);
      formData.append('contact', form.phoneNumber);
      formData.append('content', form.content);
      
      selectedImages.forEach((file, index) => {
        formData.append('attachments', file);
      });

      const response = await inquiry.createInquiry(formData);
      setSuccess(true);
      setForm({ title: '', email: '', phoneNumber: '', content: '' });
      setSelectedImages([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
    } catch (err) {
      setError('문의 접수 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('Inquiry submission error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <main className={styles.main}>
        <div className={styles.successMessage}>
          <h2 className="font-bold">문의가 접수되었습니다</h2>
          <p>답변은 입력하신 이메일로 발송됩니다.</p>
          <Button 
            onClick={() => setSuccess(false)}
            className={styles.bottomBtn}
          >
            새 문의하기
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <InputBox
        id="title"
        label="제목"
        placeholder="제목을 입력해주세요"
        value={form.title}
        onChangeObj={handleFormChange}
        required
      />
      <InputBox
        id="email"
        label="이메일"
        type="email"
        placeholder="이메일을 입력해주세요"
        value={form.email}
        onChangeObj={handleFormChange}
        required
      />
      <InputBox
        id="phoneNumber"
        label="연락처"
        placeholder="연락처를 입력해주세요"
        value={form.phoneNumber}
        onChangeObj={handleFormChange}
        required
      />
      <div>
        <Label label="문의내용" id="content" required />
        <textarea
          id="content"
          value={form.content}
          onChange={(e) => handleFormChange(e.target.id, e.target.value)}
          placeholder="문의내용을 입력해주세요"
          className={`${styles.textarea} font-guidetext`}
          maxLength={1000}
          rows={4}
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
        onClick={handleButtonClick}
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
          >
            <RemoveIcon />
          </button>
        </div>
      ))}

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      <Button 
        onClick={handleSubmit}
        disabled={isLoading}
        className={styles.bottomBtn}
      >
        {isLoading ? '접수중...' : '접수하기'}
      </Button>
    </main>
  );
}

export default CustomerInquiry;