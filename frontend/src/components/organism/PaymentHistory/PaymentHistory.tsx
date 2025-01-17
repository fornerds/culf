import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { payment } from '@/api';
import { Dropdown } from '@/components/atom/Dropdown';
import { HistoryListItem } from '@/components/molecule/HistoryListItem';
import styles from './PaymentHistory.module.css';

interface PaymentHistoryItem {
  user_id: string;
  amount: number;
  payment_method: string;
  used_coupon_id: number;
  payment_id: string;
  subscription_id: number;
  token_plan_id: number;
  payment_number: string;
  transaction_number: string;
  tokens_purchased: number;
  payment_date: string;
  status: string;
  manual_payment_reason: string;
}

type SelectOption = { optionValue: string; optionLabel: string };

export function PaymentHistory() {
  const currentYear = new Date().getFullYear();
  const [oldestYear, setOldestYear] = useState(currentYear);
  const [yearOptions, setYearOptions] = useState<SelectOption[]>([
    { optionValue: String(currentYear), optionLabel: String(currentYear) }
  ]);

  // 초기 데이터를 가져와서 가장 오래된 연도 확인
  const { data: initialData } = useQuery({
    queryKey: ['payments-initial'],
    queryFn: async () => {
      const response = await payment.getMyPayments(1, 1);
      return response.data;
    },
    onSuccess: (data) => {
      if (data && data.length > 0) {
        const oldestPaymentYear = new Date(data[0].payment_date).getFullYear();
        setOldestYear(oldestPaymentYear);
        
        // 가장 오래된 연도부터 현재 연도까지의 옵션 생성
        const years: SelectOption[] = [];
        for (let year = currentYear; year >= oldestPaymentYear; year--) {
          years.push({
            optionValue: String(year),
            optionLabel: String(year)
          });
        }
        setYearOptions(years);
      }
    }
  });

  const searchSelectOption = {
    year: yearOptions,
    month: [
      { optionValue: '', optionLabel: '전체' },
      ...Array.from({ length: 12 }, (_, i) => ({
        optionValue: String(i + 1),
        optionLabel: `${i + 1}월`
      }))
    ]
  };

  const [selectedValue, setSelectedValue] = useState({
    year: searchSelectOption.year[0],
    month: searchSelectOption.month[0]
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', selectedValue.year.optionValue, selectedValue.month.optionValue],
    queryFn: async () => {
      const filters: { year?: number; month?: number } = {
        year: parseInt(selectedValue.year.optionValue)
      };
      
      if (selectedValue.month.optionValue) {
        filters.month = parseInt(selectedValue.month.optionValue);
      }

      // 디버깅 정보를 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.group('Payment History Debug Info');
        console.log('Applied Filters:', filters);
      }

      const response = await payment.getMyPayments(1, 10, filters);
      
      // 디버깅 정보를 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.log('API Response:', response.data);
        console.groupEnd();
      }
      
      return response.data;
    }
  });

  const formatPaymentMethod = (method: string) => {
    const methodMap: { [key: string]: string } = {
      'kakaopay': '카카오페이',
      'card': '신용카드',
      'virtualaccount': '가상계좌',
      'bank': '계좌이체',
      'phone': '휴대폰결제'
    };
    return methodMap[method.toLowerCase()] || method;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'SUCCESS': 'SUCCESS',      // 원본 status 값 유지
      'CANCELLED': 'CANCELLED'   // 원본 status 값 유지
    };
    return statusMap[status] || status;
  };

  const getProductName = (payment: PaymentHistoryItem) => {
    if (payment.token_plan_id) {
      return `스톤결제 ${payment.tokens_purchased}개`;
    }
    return payment.subscription_id ? '구독결제' : '결제';
  };

  // 결제 데이터가 실제로 선택된 월에 해당하는지 확인
  const filterPaymentsByMonth = (payments: PaymentHistoryItem[]) => {
    if (!selectedValue.month.optionValue) return payments; // '전체' 선택시 모든 데이터 반환
    
    const filteredPayments = payments.filter(payment => {
      const paymentMonth = new Date(payment.payment_date).getMonth() + 1;
      return paymentMonth === parseInt(selectedValue.month.optionValue);
    });

    // 필터링 결과 디버깅
    if (process.env.NODE_ENV === 'development') {
      console.group('Payment Filtering Debug Info');
      console.log('Selected Month:', selectedValue.month.optionValue);
      console.log('Filtered Payments Count:', filteredPayments.length);
      console.groupEnd();
    }

    return filteredPayments;
  };

  if (error) {
    return (
      <div className={styles.errorMessage}>
        결제 내역을 불러오는 중 오류가 발생했습니다.
      </div>
    );
  }

  const filteredData = data ? filterPaymentsByMonth(data) : [];

  return (
    <main className={styles.selectContainerWrap}>
      <div className={styles.selectContainer}>
        <Dropdown
          id="year"
          selectOption={searchSelectOption.year}
          onChange={(state: SelectOption) => {
            setSelectedValue(prevState => ({
              ...prevState,
              year: state
            }));
          }}
          value={selectedValue.year}
        />
        <Dropdown
          id="month"
          selectOption={searchSelectOption.month}
          onChange={(state: SelectOption) => {
            setSelectedValue(prevState => ({
              ...prevState,
              month: state
            }));
          }}
          value={selectedValue.month}
        />
      </div>

      {isLoading ? (
        <div className={styles.loadingMessage}>결제 내역을 불러오는 중...</div>
      ) : !filteredData || filteredData.length === 0 ? (
        <div className={styles.emptyMessage}>결제 내역이 없습니다.</div>
      ) : (
        filteredData.map((payment: PaymentHistoryItem) => (
          <HistoryListItem
            key={payment.payment_id}
            id={payment.payment_id}
            productName={getProductName(payment)}
            paymentMethod={formatPaymentMethod(payment.payment_method)}
            paymentAmount={formatAmount(payment.amount)}
            paymentDate={new Date(payment.payment_date).toLocaleDateString('ko-KR')}
            status={formatStatus(payment.status)}
          />
        ))
      )}
    </main>
  );
}