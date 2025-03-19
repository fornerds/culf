// hooks/payment/usePayment.ts
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { payment } from '@/api';
import { useTokenStore } from '@/state/client/useStoneStore';

export interface PaymentData {
  plan_id: number;
  pg: string;
  pay_method?: string;
  coupon_code?: string;
}

interface PaymentCompletionData {
  imp_uid: string;
  merchant_uid: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  type: 'subscription' | 'token';
  token_amount?: number;
  duration_days?: number;
  is_active: boolean;
}

export interface CouponValidationResponse {
  coupon_id: number;
  code: string;
  discount_type: 'percentage' | 'amount';
  discount_value: number;
  is_valid: boolean;
  message?: string;
}

export interface PaymentResponse {
  payment_id: string;
  merchant_uid: string;
  amount: number;
  redirect_url: string;
}

export interface PaymentVerificationResponse {
  payment_id: string;
  status: 'success' | 'failed';
  message: string;
  tokens_added?: number;
}

export interface PaymentHistoryItem {
  payment_id: string;
  product_name: string;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export interface PaymentHistoryResponse {
  payments: PaymentHistoryItem[];
  total_count: number;
}

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { setShouldRefresh } = useTokenStore();

  // 상품 목록 조회
  const getProductsQuery = useQuery<Product[], Error>({
    queryKey: ['payment', 'products'],
    queryFn: async () => {
      const response = await payment.getProducts();
      return response.data;
    },
  });

  // 단일 상품 정보 조회 (스톤/구독)
  const getProductQuery = (
    productId: string,
    productType: 'subscription' | 'token' | 'stone',
  ) =>
    useQuery<Product, Error>({
      queryKey: ['payment', 'product', productId, productType],
      queryFn: async () => {
        // stone을 token으로 변환하여 API 호출
        const apiProductType = productType === 'stone' ? 'token' : productType;
        const response = await payment.getProductById(
          productId,
          apiProductType,
        );
        return response.data;
      },
      enabled: !!productId,
    });

  // 쿠폰 검증
  const validateCouponMutation = useMutation<
    CouponValidationResponse,
    Error,
    string
  >({
    mutationFn: async (couponCode: string) => {
      const response = await payment.validateCoupon(couponCode);
      return response.data;
    },
  });

  // 단일 결제 (스톤)
  const createPaymentMutation = useMutation<
    PaymentResponse,
    Error,
    PaymentData
  >({
    mutationFn: async (paymentData: PaymentData) => {
      const response = await payment.createSinglePayment(paymentData);
      return response.data;
    },
  });

  // 구독 결제
  const createSubscriptionMutation = useMutation<
    PaymentResponse,
    Error,
    PaymentData
  >({
    mutationFn: async (subscriptionData: PaymentData) => {
      const response = await payment.createSubscription(subscriptionData);
      return response.data;
    },
  });

  // 결제 검증 뮤테이션
  const verifyPaymentMutation = useMutation<
    PaymentVerificationResponse,
    Error,
    PaymentCompletionData
  >({
    mutationFn: async (verificationData: PaymentCompletionData) => {
      const response = await payment.verifyPayment(verificationData);
      return response.data;
    },
    onSuccess: (data) => {
      // 토큰 구매 성공 시 스토어 업데이트 필요 플래그 설정
      if (data && data.tokens_added) {
        setShouldRefresh(true);
      }
    },
  });

  // 결제 내역 조회
  const getPaymentHistoryQuery = useQuery<PaymentHistoryResponse, Error>({
    queryKey: ['payment', 'history'],
    queryFn: async () => {
      const response = await payment.getMyPayments();
      return response.data;
    },
  });

  // 특정 결제 내역 조회
  const getPaymentDetailQuery = (paymentId: string) =>
    useQuery<PaymentHistoryItem, Error>({
      queryKey: ['payment', 'detail', paymentId],
      queryFn: async () => {
        const response = await payment.getPaymentById(paymentId);
        return response.data;
      },
      enabled: !!paymentId,
    });

  // 결제 취소 뮤테이션
  const cancelPaymentMutation = useMutation<
    void,
    Error,
    { paymentId: string; formData: FormData }
  >({
    mutationFn: async ({ paymentId, formData }) => {
      await payment.cancelPayment(paymentId, formData);
    },
  });

  // 유틸리티 함수들
  const validateCoupon = async (couponCode: string) => {
    setIsLoading(true);
    try {
      return await validateCouponMutation.mutateAsync(couponCode);
    } finally {
      setIsLoading(false);
    }
  };

  const createPayment = async (paymentData: PaymentData) => {
    setIsLoading(true);
    try {
      return await createPaymentMutation.mutateAsync(paymentData);
    } finally {
      setIsLoading(false);
    }
  };

  const createSubscription = async (subscriptionData: PaymentData) => {
    setIsLoading(true);
    try {
      return await createSubscriptionMutation.mutateAsync(subscriptionData);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPayment = async (verificationData: PaymentCompletionData) => {
    setIsLoading(true);
    try {
      return await verifyPaymentMutation.mutateAsync(verificationData);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelPayment = async (paymentId: string, formData: FormData) => {
    setIsLoading(true);
    try {
      await cancelPaymentMutation.mutateAsync({ paymentId, formData });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // 상태
    isLoading,

    // 쿼리
    products: getProductsQuery,
    getProduct: getProductQuery,
    paymentHistory: getPaymentHistoryQuery,
    getPaymentDetail: getPaymentDetailQuery,

    // 뮤테이션
    validateCoupon,
    createPayment,
    createSubscription,
    verifyPayment,
    cancelPayment,

    // Raw 뮤테이션 (더 세밀한 제어를 위해)
    validateCouponMutation,
    createPaymentMutation,
    createSubscriptionMutation,
    verifyPaymentMutation,
    cancelPaymentMutation,
  };
};

export default usePayment;
