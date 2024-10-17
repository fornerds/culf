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
        {status === 'SUCCESS' && (
          <Link to="/cancel-payment" className={styles.cancelButton}>
            <div className={styles.cancelButtonText}>취소요청</div>
            <div>
              <button
                className={styles.button}
                onClick={() => console.log('취소요청')}
              >
                <RightIcon />
              </button>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
