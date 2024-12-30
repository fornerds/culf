// hooks/payment/usePayment.ts
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { payment } from '@/api';

interface PaymentMethod {
  id: 'creditcard' | 'virtualaccount' | 'bank' | 'phone' | 'kakaopay';
  label: string;
}

interface PaymentData {
  plan_id: number;
  quantity: number;
  environment: string;
  coupon_code?: string;
}

interface PaymentErrorResponse {
  detail: string;
}

interface CouponValidationResponse {
  is_valid: boolean;
  discount_value: number;
  reason?: string;
  message?: string;
}

interface SubscriptionProduct {
  plan_id: number;
  plan_name: string;
  price: string;
  discounted_price: string;
  tokens_included: number;
  description: string;
  is_promotion: boolean;
  promotion_details: any;
  created_at: string;
  updated_at: string;
}

interface TokenProduct {
  token_plan_id: number;
  tokens: number;
  price: string;
  discounted_price: string;
  discount_rate: string;
  is_promotion: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductsResponse {
  subscription_plans: SubscriptionProduct[];
  token_plans: TokenProduct[];
}

interface PaymentResponse {
  payment_id?: number;
  amount?: number;
  payment_method?: PaymentMethod['id'];
  status?: 'SUCCESS' | 'FAILED';
  redirect_url?: string;
}

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod['id'] | ''>('');

  // 상품 목록 조회
  const getProductsQuery = useQuery<ProductsResponse>({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await payment.getProducts();
      return response.data;
    },
  });

  // 개별 상품 조회
  const getProductById = (productId: string, productType: 'subscription' | 'token') =>
    useQuery({
      queryKey: ['product', productId, productType],
      queryFn: async () => {
        const response = await payment.getProductById(productId, productType);
        return response.data;
      },
      enabled: !!productId && !!productType,
    });

  // 결제 데이터 유효성 검증
  const validatePaymentData = (data: PaymentData): boolean => {
    if (!data.plan_id) {
      console.log(data)
      throw new Error('유효하지 않은 상품입니다.');
    }
    if (!data.quantity || data.quantity <= 0) {
      throw new Error('수량은 1개 이상이어야 합니다.');
    }
    if (!data.environment) {
      throw new Error('환경 정보가 필요합니다.');
    }
    return true;
  };

  // 쿠폰 검증 mutation
  const validateCouponMutation = useMutation<CouponValidationResponse, Error, string>({
    mutationFn: async (couponCode) => {
      try {
        const response = await payment.validateCoupon(couponCode);
        return response.data;
      } catch (error: any) {
        console.error('Coupon validation failed:', {
          error: error,
          response: error.response?.data
        });
        throw new Error(error.response?.data?.message || '쿠폰 검증에 실패했습니다.');
      }
    },
  });

  // 단건 결제 mutation
  const processSinglePaymentMutation = useMutation<PaymentResponse, Error, PaymentData>({
    mutationFn: async (paymentData) => {
      try {
        validatePaymentData(paymentData);
        const response = await payment.createSinglePayment(paymentData);
        
        if (!response?.data) {
          throw new Error('결제 응답이 올바르지 않습니다.');
        }
        
        return response.data;
      } catch (error: any) {
        console.error('Single payment failed:', {
          error: error,
          response: error.response?.data
        });

        if (error.response?.status === 400) {
          const errorResponse = error.response?.data as PaymentErrorResponse;
          throw new Error(errorResponse?.detail || '결제 데이터가 올바르지 않습니다.');
        }
        if (error.response?.status === 401) {
          throw new Error('로그인이 필요합니다.');
        }
        throw new Error(error.response?.data?.detail || '결제 처리 중 오류가 발생했습니다.');
      }
    },
  });

  // 구독 결제 mutation
  const processSubscriptionMutation = useMutation<PaymentResponse, Error, PaymentData>({
    mutationFn: async (subscriptionData) => {
      try {
        validatePaymentData(subscriptionData);
        const response = await payment.createSubscription(subscriptionData);
        
        if (!response?.data) {
          throw new Error('결제 응답이 올바르지 않습니다.');
        }
        
        return response.data;
      } catch (error: any) {
        console.error('Subscription payment failed:', {
          error: error,
          response: error.response?.data
        });

        if (error.response?.status === 400) {
          const errorResponse = error.response?.data as PaymentErrorResponse;
          throw new Error(errorResponse?.detail || '구독 데이터가 올바르지 않습니다.');
        }
        if (error.response?.status === 401) {
          throw new Error('로그인이 필요합니다.');
        }
        throw new Error(error.response?.data?.detail || '구독 결제 처리 중 오류가 발생했습니다.');
      }
    },
  });

  // 쿠폰 검증
  const validateCoupon = async (couponCode: string) => {
    setIsLoading(true);
    try {
      console.log('Validating coupon:', couponCode);
      const result = await validateCouponMutation.mutateAsync(couponCode);
      console.log('Coupon validation result:', result);
      return result;
    } catch (error) {
      console.error('Coupon validation error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 단건 결제 처리
  const processSinglePayment = async (paymentData: PaymentData) => {
    setIsLoading(true);
    try {
      console.log('Processing single payment:', paymentData);
      const response = await processSinglePaymentMutation.mutateAsync(paymentData);
      
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        throw new Error('결제 페이지 URL을 받지 못했습니다.');
      }
      
      return response;
    } catch (error) {
      console.error('Single payment process error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 구독 결제 처리
  const processSubscription = async (subscriptionData: PaymentData) => {
    setIsLoading(true);
    try {
      console.log('Processing subscription:', subscriptionData);
      const response = await processSubscriptionMutation.mutateAsync(subscriptionData);
      
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        throw new Error('결제 페이지 URL을 받지 못했습니다.');
      }
      
      return response;
    } catch (error) {
      console.error('Subscription process error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    getProducts: getProductsQuery,
    getProductById,
    validateCoupon,
    processSinglePayment,
    processSubscription,
    selectedPayment,
    setSelectedPayment,
  };
};