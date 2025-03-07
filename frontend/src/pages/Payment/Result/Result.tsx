import { Button } from '@/components/atom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Result.module.css';

export function Result() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL 파라미터 파싱
  const isSuccess = searchParams.has('success');
  const isFail = searchParams.has('fail');
  const reason = searchParams.get('reason');

  // 상태에 따른 메시지와 버튼 링크 설정
  let message = '';
  let buttonLink = '';

  if (isSuccess) {
    message = '결제가 성공적으로 완료되었습니다!';
    buttonLink = '/';
  } else if (isFail) {
    message = `결제에 실패하였습니다. 실패 원인: ${reason || '알 수 없는 오류'}`;
    buttonLink = '/';
  } else {
    message = '정상적으로 결제 취소를 요청했습니다.';
    buttonLink = '/';
  }

  // 버튼 클릭 핸들러
  const handleButtonClick = () => {
    navigate(buttonLink);
  };

  return (
    <main className={styles.container}>
      <div className={`${styles.message} font-title-3`}>{message}</div>
      <Button
        onClick={handleButtonClick}
        variant="default"
        className={styles.button}
      >
        홈으로 이동하기
      </Button>
    </main>
  );
}

export default Result;
