// hooks/payment/usePayment.ts
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { payment } from '@/api';
import { PAYMENT_CONFIG } from '@/config/payment';

interface PaymentMethod {
  id: 'creditcard' | 'virtualaccount' | 'bank' | 'phone' | 'kakaopay';
  label: string;
}

interface PaymentData {
  plan_id: number;
  pg: string;
  pay_method?: string;
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

const paymentLogger = {
  debug: (message: string, data?: any) => {
    console.debug(`[Payment Debug] ${message}`, data || '');
  },
  error: (message: string, error: any) => {
    console.error(`[Payment Error] ${message}`, {
      error,
      stack: error?.stack,
      response: error?.response?.data,
      status: error?.response?.status,
    });
  },
};

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<
    PaymentMethod['id'] | ''
  >('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const pgProviders = PAYMENT_CONFIG.pgProviders;
  const payMethods = PAYMENT_CONFIG.payMethods;

  // 상품 목록 조회
  const getProducts = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await payment.getProducts();
      return response.data;
    },
  });

  // 개별 상품 조회
  const getProductById = (
    productId: string,
    productType: 'subscription' | 'token',
  ) =>
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
      throw new Error('유효하지 않은 상품입니다.');
    }
    if (!data.pg) {
      throw new Error('결제 방식을 선택해주세요.');
    }
    if (data.pg === pgProviders.DANAL_TPAY && !data.pay_method) {
      throw new Error('결제 수단을 선택해주세요.');
    }
    return true;
  };

  // 쿠폰 검증 mutation
  const validateCouponMutation = useMutation({
    mutationFn: async (couponCode: string) => {
      try {
        const response = await payment.validateCoupon(couponCode);
        return response.data;
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message || '쿠폰 검증에 실패했습니다.',
        );
      }
    },
  });

  const handlePaymentResult = async (rsp: any) => {
    if (rsp.success) {
      try {
        const verifyResponse = await payment.verifyPayment({
          imp_uid: rsp.imp_uid,
          merchant_uid: rsp.merchant_uid,
        });

        if (verifyResponse.status === 200) {
          // 결제 성공 후 토큰과 구독 정보 갱신
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['tokenInfo'] }),
            queryClient.invalidateQueries({ queryKey: ['subscriptionInfo'] }),
          ]);
          navigate('/payment/result?success=true');
        } else {
          throw new Error('결제 검증에 실패했습니다.');
        }
      } catch (error: any) {
        setErrorMessage(error.message || '결제 검증 중 오류가 발생했습니다.');
        setShowErrorPopup(true);
      }
    } else {
      setErrorMessage(rsp.error_msg || '결제에 실패했습니다.');
      setShowErrorPopup(true);
      navigate(
        `/payment/result?fail&reason=${rsp.error_msg || '결제에 실패했습니다'}`,
      );
    }
  };

  const processSinglePaymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentData) => {
      try {
        paymentLogger.debug('Processing single payment:', paymentData);

        validatePaymentData(paymentData);
        const response = await payment.createSinglePayment(paymentData);

        paymentLogger.debug('Payment creation response:', response);

        if (!response?.data) {
          throw new Error('결제 응답이 올바르지 않습니다.');
        }

        const { IMP } = window;
        if (!IMP) {
          paymentLogger.error(
            'Portone SDK not loaded',
            new Error('SDK not found'),
          );
          throw new Error('포트원 SDK가 로드되지 않았습니다.');
        }

        return new Promise((resolve, reject) => {
          paymentLogger.debug(
            'Requesting payment:',
            response.data.payment_data,
          );

          IMP.request_pay(
            response.data.payment_data,
            async function (rsp: any) {
              const success = await handlePaymentCompletion(rsp);
              if (success) {
                resolve(rsp);
              } else {
                reject(new Error(rsp.error_msg || '결제에 실패했습니다.'));
              }
            },
          );
        });
      } catch (error: any) {
        paymentLogger.error('Payment processing failed:', error);
        setErrorMessage(error.message || '결제 처리 중 오류가 발생했습니다.');
        setShowErrorPopup(true);
        throw error;
      }
    },
  });

  const processSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionData: PaymentData) => {
      try {
        validatePaymentData(subscriptionData);
        const response = await payment.createSubscription(subscriptionData);

        if (!response?.data?.payment_data) {
          throw new Error('결제 데이터가 올바르지 않습니다.');
        }

        const { IMP } = window;
        if (!IMP) throw new Error('포트원 SDK가 로드되지 않았습니다.');

        return new Promise((resolve, reject) => {
          IMP.request_pay(
            response.data.payment_data,
            async function (rsp: any) {
              const success = await handlePaymentCompletion(rsp);
              if (success) {
                resolve(rsp);
              } else {
                reject(new Error(rsp.error_msg || '결제에 실패했습니다.'));
              }
            },
          );
        });
      } catch (error: any) {
        setErrorMessage(error.message || '결제 처리 중 오류가 발생했습니다.');
        setShowErrorPopup(true);
        throw error;
      }
    },
  });

  // 쿠폰 검증
  const validateCoupon = async (couponCode: string) => {
    setIsLoading(true);
    try {
      const result = await validateCouponMutation.mutateAsync(couponCode);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const processSinglePayment = async (paymentData: any) => {
    setIsLoading(true);
    try {
      const response = await payment.createSinglePayment(paymentData);
      if (!response?.data?.payment_data) {
        throw new Error('결제 데이터가 올바르지 않습니다.');
      }

      const { IMP } = window;
      if (!IMP) throw new Error('포트원 SDK가 로드되지 않았습니다.');

      IMP.request_pay(response.data.payment_data, handlePaymentResult);
    } catch (error: any) {
      setErrorMessage(error.message || '결제 처리 중 오류가 발생했습니다.');
      setShowErrorPopup(true);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const processSubscription = async (subscriptionData: any) => {
    setIsLoading(true);
    try {
      const response = await payment.createSubscription(subscriptionData);
      if (!response?.data?.payment_data) {
        throw new Error('결제 데이터가 올바르지 않습니다.');
      }

      const { IMP } = window;
      if (!IMP) throw new Error('포트원 SDK가 로드되지 않았습니다.');

      IMP.request_pay(response.data.payment_data, handlePaymentResult);
    } catch (error: any) {
      setErrorMessage(error.message || '결제 처리 중 오류가 발생했습니다.');
      setShowErrorPopup(true);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    pgProviders,
    payMethods,
    getProducts,
    getProductById,
    validateCoupon,
    processSinglePayment,
    processSubscription,
    errorMessage,
    setErrorMessage,
    showErrorPopup,
    setShowErrorPopup,
  };
};
