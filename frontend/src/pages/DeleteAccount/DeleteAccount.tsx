import { Button } from '@/components/atom';
import styles from './DeleteAccount.module.css';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/atom/Checkbox';

export function DeleteAccount() {
  const navigate = useNavigate();
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [userText, setUserText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const checkboxList = [
    { id: '1', label: '사용을 잘 안해요' },
    { id: '2', label: '컨텐츠가 큰 도움이 안돼요' },
    { id: '3', label: '챗봇이 생각보다 별로에요' },
    { id: '4', label: '너무 비싸요' },
    { id: '5', label: '삭제해야하는 개인정보가 있어요' },
    { id: '6', label: '기타' },
  ];

  const handleCheckboxChange = (value: string, isChecked: boolean) => {
    setSelectedValues((prev) =>
      isChecked ? [...prev, value] : prev.filter((item) => item !== value),
    );

    if (value === checkboxList[checkboxList.length - 1].id && !isChecked) {
      setUserText('');
    }
  };

  const handleFormChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUserText(e.target.value);
  };

  useEffect(() => {
    if (
      selectedValues.includes(checkboxList[checkboxList.length - 1].id) &&
      textareaRef.current
    ) {
      textareaRef.current.focus();
    }
  }, [selectedValues]);

  return (
    <>
      <main className={styles.main}>
        <div className="font-title-3">
          앗! 떠나시려구요..?
          <br />
          불편한점이 있으셨나봐요.
        </div>
        <div className={`${styles.textSub} font-text-3`}>
          저희에게 알려주시면 더욱 나아진 모습이 되겠습니다.
        </div>
        <div className={styles.formWrapper}>
          {checkboxList.map((item, index) => (
            <Checkbox
              key={item.id}
              id={item.id}
              label={item.label}
              checked={selectedValues.includes(item.id)}
              onChange={handleCheckboxChange}
            />
          ))}
          <textarea
            ref={textareaRef}
            id="content"
            value={userText}
            onChange={handleFormChange}
            placeholder="내용을 입력해주세요"
            disabled={
              !selectedValues.includes(checkboxList[checkboxList.length - 1].id)
            }
            className={`${styles.textarea} ${!selectedValues.includes(checkboxList[checkboxList.length - 1].id) && styles.disabled} font-guidetext`}
            maxLength={1000}
            rows={1}
          />
        </div>
        <div className={styles.bottom}>
          <div className="font-text-3">
            탈퇴하시면 그동안 결제한 서비스는 더이상 이용하지 못합니다. 그래도
            탈퇴하시겠어요?
          </div>
          <div className={styles.buttonGroup}>
            <Button
              size="size3"
              variant="warning"
              className={`${styles.button} ${styles.textSub}`}
            >
              예, 탈퇴할게요
            </Button>
            <Button
              size="size3"
              variant="less-highlight"
              onClick={() => navigate(-1)}
            >
              아니오
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
