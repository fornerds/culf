import { BillingType, getBillingTag } from '@/utils/getBillingTag';
import styles from './HistoryListItem.module.css';
import { Tag } from '@/components/atom/Tag';
import RightIcon from '@/assets/icons/right-small.svg?react';
import { Link } from 'react-router-dom';

interface HistoryProps {
  id: string;
  productName: string;
  paymentMethod: string;
  paymentAmount: string;
  paymentDate: string;
  status: string;
}

export function HistoryListItem({
  id,
  productName,
  paymentMethod,
  paymentAmount,
  paymentDate,
  status,
}: HistoryProps) {

  console.log('Status in HistoryListItem:', status);
  
  const showCancelButton = () => {
    return status === 'SUCCESS'; // true 또는 false를 반환하도록 수정
  };

  return (
    <div className={styles.historyItem}>
      <div className={`font-text-4 ${styles.historyRow}`}>
        <span>결제번호</span>
        <span>{id}</span>
      </div>
      <div className={`font-text-4 ${styles.historyRow}`}>
        <span>상품명</span>
        <span>{productName}</span>
      </div>
      <div className={`font-text-4 ${styles.historyRow}`}>
        <span>결제수단</span>
        <span>{paymentMethod}</span>
      </div>
      <div className={`font-text-4 ${styles.historyRow}`}>
        <span>결제액</span>
        <span>{paymentAmount}</span>
      </div>
      <div className={`font-text-4 ${styles.historyRow}`}>
        <span>결제일</span>
        <span>{paymentDate}</span>
      </div>
      <div className={styles.historyBottom}>
        <Tag {...getBillingTag(status as BillingType)} />
        {showCancelButton() && (
          <Link 
            to={`/cancel-payment/${id}`} 
            className={styles.cancelButton}
            aria-label="결제 취소 요청하기"
          >
            <div className={styles.cancelButtonText}>취소요청</div>
            <div className={styles.button}>
              <RightIcon />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}