import { Header } from '@/components/organism';
import styles from './Chat.module.css';

export function Chat() {
  return (
    <>
      <Header
        title="국내여행 큐레이터"
        showMenuButton={true}
        onMenuClick={() => console.log('메뉴 열기')}
      />
    </>
  );
}
