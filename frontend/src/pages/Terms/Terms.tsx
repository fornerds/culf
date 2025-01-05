import { Checkbox } from '@/components/atom/Checkbox';
import styles from './Terms.module.css';
import { ChangeEvent, useEffect, useState } from 'react';
import { Button } from '@/components/atom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/state/client/authStore';

export function Terms() {
  const navigate = useNavigate();
  const { selectedValues, setSelectedValues, setIsMarketingAgreed } =
    useAuthStore();
  const [isAllSelected, setIsAllSelected] = useState<boolean>(false);

  const checkboxList = [
    {
      id: '1',
      label: '(필수) 제 나이는 만 14세 이상입니다.',
      isRequired: true,
    },
    { id: '2', label: '(필수) 서비스약관 동의', isRequired: true },
    { id: '3', label: '(필수) 개인정보수집이용 동의', isRequired: true },
    { id: '4', label: '(선택) 마케팅정보활용 동의', isRequired: false },
  ];

  const handleAllSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsAllSelected(checked);
    checked
      ? setSelectedValues(checkboxList.map((item) => item.id))
      : setSelectedValues([]);
  };

  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setSelectedValues((prev) =>
      checked ? [...prev, value] : prev.filter((item) => item !== value),
    );
  };

  const requiredIds = checkboxList
    .filter((item) => item.isRequired)
    .map((item) => item.id);
  const areRequiredChecked = requiredIds.every((id) =>
    selectedValues.includes(id),
  );

  const goSignUpPage = () => {
    // 디버깅 로그 추가
    console.log('Terms - Final marketing state:', selectedValues.includes('4'));
    navigate('/signup');
  };

  useEffect(() => {
    setIsAllSelected(selectedValues.length === checkboxList.length);
    setIsMarketingAgreed(selectedValues.includes('4'));
    // 디버깅 로그 추가
    console.log('Terms - Marketing agreed:', selectedValues.includes('4'));
  }, [selectedValues]);

  return (
    <>
      <main className={styles.main}>
        <div className="font-title-1">약관 동의가 필요해요.</div>
        <Checkbox
          key="all"
          id="all"
          value="all"
          label="모두 동의"
          checked={isAllSelected}
          onChange={handleAllSelect}
        />
        <div className={styles.checkboxGroup}>
          {checkboxList.map((item, index) => (
            <Checkbox
              key={item.id}
              id={item.id}
              value={item.id}
              label={item.label}
              checked={selectedValues.includes(item.id)}
              onChange={handleCheckboxChange}
            />
          ))}
        </div>
        <div className={styles.bottom}>
          <Button
            variant={!areRequiredChecked ? 'disable' : 'default'}
            disabled={!areRequiredChecked}
            onClick={goSignUpPage}
          >
            다음
          </Button>
        </div>
      </main>
    </>
  );
}
