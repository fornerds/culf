import { InputBox } from '@/components/molecule/InputBox';
import styles from './CancelPayment.module.css';
import { ChangeEvent, useRef, useState } from 'react';
import { Button, Label } from '@/components/atom';
import RemoveIcon from '@/assets/icons/remove.svg?react';

export function CancelPayment() {
  const [form, setForm] = useState({
    title: '',
    email: '',
    phoneNumber: '',
    content: '',
  });

  const handleFormChange = (id: string, value: string) => {
    setForm({
      ...form,
      [id]: value,
    });
  };

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(URL.createObjectURL(file));
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <main className={styles.main}>
        <InputBox
          id="title"
          label="제목"
          placeholder="제목을 입력해주세요"
          value={form.title}
          onChangeObj={handleFormChange}
        />
        <InputBox
          id="email"
          label="이메일"
          type="email"
          placeholder="이메일을 입력해주세요"
          value={form.email}
          onChangeObj={handleFormChange}
        />
        <InputBox
          id="phoneNumber"
          label="연락처"
          placeholder="연락처를 입력해주세요"
          value={form.phoneNumber}
          onChangeObj={handleFormChange}
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
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
          ref={inputRef}
        />
        <Button size="size2" variant="plus_icon" onClick={handleButtonClick}>
          사진 업로드
        </Button>
        {selectedImage && (
          <div className={styles.selectedImageWrapper}>
            <img
              src={selectedImage}
              alt="Selected"
              className={styles.selectedImage}
            />
            <button onClick={handleRemoveImage} className={styles.removeBtn}>
              <RemoveIcon />
            </button>
          </div>
        )}
        <Button className={styles.bottomBtn}>접수하기</Button>
      </main>
    </>
  );
}
