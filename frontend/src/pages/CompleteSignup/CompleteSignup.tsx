import { Button } from '@/components/atom';
import styles from './CompleteSignup.module.css';
import { useNavigate } from 'react-router-dom';

export function CompleteSignup() {
  const navigate = useNavigate();

  const goMainPage = () => {
    navigate('/');
  };

  // 이미지 URL을 생성하는 헬퍼 함수
  function getImageUrl(name: string): string {
    return new URL(`../../assets/images/${name}`, import.meta.url).href;
  }

  return (
    <>
      <main className={styles.main}>
        <div className="font-title-1">회원가입 완료</div>
        <div className={styles.subTitle}>
          AI 큐레이터와{' '}
          <span className={styles.point}>
            무료로 대화해볼 수 있는 토큰이 지급
          </span>
          되었습니다!
        </div>
        <img
          className={styles.image}
          src={getImageUrl('character02.png')}
          alt="completesignup"
          width="220px"
          height="220px"
        />
        <div className={styles.buttonArea}>
          <Button onClick={goMainPage}>메인 화면으로</Button>
        </div>
      </main>
    </>
  );
}
