import { Dropdown } from '@/components/atom/Dropdown';
import styles from './PaymentHistory.module.css';
import { SelectOption } from '@/components/atom/Dropdown/Dropdown';
import { useState } from 'react';
import { HistoryListItem } from '@/components/molecule/HistoryListItem';

export function PaymentHistory() {
  const searchSelectOption = {
    year: [{ optionValue: '2024', optionLabel: '2024' }],
    month: [...Array(12)].map((_, index) => ({
      optionValue: `${index + 1}`,
      optionLabel: `${index + 1}월`,
    })),
  };

  const [selectedValue, setSelectedValue] = useState({
    year: { optionValue: '2024', optionLabel: '2024' },
    month: { optionValue: '7', optionLabel: '7월' },
  });

  const historiesData = [
    {
      paymentId: 'MKFJ8224070402',
      productName: '토큰결제 50개',
      paymentMethod: '카카오페이',
      paymentAmount: '4,000원',
      paymentDate: '2024-07-04',
      status: 'SUCCESS',
    },
    {
      paymentId: 'MKFJ8224070403',
      productName: '토큰결제 50개',
      paymentMethod: '카카오페이',
      paymentAmount: '4,000원',
      paymentDate: '2024-07-04',
      status: 'CANCELED',
    },
  ];

  return (
    <main className={styles.selectContainerWrap}>
      <div className={styles.selectContainer}>
        <Dropdown
          id="year"
          selectOption={searchSelectOption.year}
          onChange={(state: SelectOption) => {
            console.log('state', state);
            setSelectedValue((prevState) => ({
              ...prevState,
              year: state,
            }));
          }}
          value={selectedValue.year}
        />
        <Dropdown
          id="month"
          selectOption={searchSelectOption.month}
          onChange={(state: SelectOption) => {
            console.log('state', state);
            setSelectedValue((prevState) => ({
              ...prevState,
              month: state,
            }));
          }}
          value={selectedValue.month}
        />
      </div>
      {historiesData.map((history) => (
        <HistoryListItem
          key={history.paymentId}
          id={history.paymentId}
          productName={history.productName}
          paymentMethod={history.paymentMethod}
          paymentAmount={history.paymentAmount}
          paymentDate={history.paymentDate}
          status={history.status}
        />
      ))}
    </main>
  );
}
