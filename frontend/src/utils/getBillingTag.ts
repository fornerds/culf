import { TagProps } from '@/components/atom/Tag/Tag';

export type BillingType = 'SUCCESS' | 'CANCELLED';

export const getBillingTag = (type: BillingType): TagProps => {
  switch (type) {
    case 'SUCCESS':
      return { text: '결제완료', variant: 'keycolor5' };
    case 'CANCELLED':  
      return { text: '결제취소', variant: 'warning' };
    default:
      console.log('Unexpected billing type:', type); // 디버깅을 위한 로그 추가
      return { text: '상태없음', variant: 'default' };
  }
};