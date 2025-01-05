// state/server/paymentQueries.ts
import {
  useQuery,
  useMutation,
  UseQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import { payment, subscription } from '../../api';
import { AxiosError } from 'axios';

interface Product {
  product_id: string;
  name: string;
  expiry_date: string;
  original_price: number;
  discount: {
    amount: number;
    coupon_discount: number;
  };
  final_price: number;
}

interface CouponValidationResponse {
  is_valid: boolean;
  coupon_details?: {
    discount_type: 'AMOUNT' | 'RATE';
    discount_value: number;
    expiration_date: string;
  };
  message: string;
}

interface PaymentResponse {
  payment_id: number;
  amount: number;
  payment_method: 'card' | 'kakaopay';
  status: 'SUCCESS' | 'FAILED';
}

interface SubscriptionInfo {
  subscription_id: number;
  plan_id: number;
  plan_name: string;
  price: string;
  start_date: string;
  next_billing_date: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
}

interface PaymentData {
  product_type: 'subscription' | 'token';
  product_id: number;
  payment_method: 'card' | 'kakaopay';
  coupon_code?: string;
}

export const useGetProducts = (): UseQueryResult<Product[], AxiosError> =>
  useQuery({
    queryKey: ['products'],
    queryFn: () => payment.getProducts().then((response) => response.data),
  });

export const useGetProductById = (
  productId: string,
): UseQueryResult<Product, AxiosError> =>
  useQuery({
    queryKey: ['product', productId],
    queryFn: () =>
      payment.getProductById(productId).then((response) => response.data),
  });

export const useValidateCoupon = (): UseMutationResult<
  CouponValidationResponse,
  AxiosError,
  { couponCode: string; productId: string }
> =>
  useMutation({
    mutationFn: ({ couponCode, productId }) =>
      payment
        .validateCoupon(couponCode, productId)
        .then((response) => response.data),
  });

export const useCreatePayment = (): UseMutationResult<
  PaymentResponse,
  AxiosError,
  PaymentData
> =>
  useMutation({
    mutationFn: (paymentData) =>
      payment.createPayment(paymentData).then((response) => response.data),
  });

export const useGetMyPayments = (
  page: number = 1,
  limit: number = 10,
): UseQueryResult<PaymentResponse[], AxiosError> =>
  useQuery({
    queryKey: ['myPayments', page, limit],
    queryFn: () =>
      payment.getMyPayments(page, limit).then((response) => response.data),
  });

export const useGetPaymentById = (
  paymentId: string,
): UseQueryResult<PaymentResponse, AxiosError> =>
  useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () =>
      payment.getPaymentById(paymentId).then((response) => response.data),
  });

export const useCancelPayment = (): UseMutationResult<
  void,
  AxiosError,
  { paymentId: string; cancellationData: any }
> =>
  useMutation({
    mutationFn: ({ paymentId, cancellationData }) =>
      payment
        .cancelPayment(paymentId, cancellationData)
        .then((response) => response.data),
  });

export const useGetMySubscription = (): UseQueryResult<
  SubscriptionInfo,
  AxiosError
> =>
  useQuery({
    queryKey: ['mySubscription'],
    queryFn: () =>
      subscription.getMySubscription().then((response) => response.data),
  });

export const useChangeSubscription = (): UseMutationResult<
  void,
  AxiosError,
  number
> =>
  useMutation({
    mutationFn: (planId) =>
      subscription.changeSubscription(planId).then((response) => response.data),
  });

export const useCancelSubscription = (): UseMutationResult<
  void,
  AxiosError,
  void
> =>
  useMutation({
    mutationFn: () =>
      subscription.cancelSubscription().then((response) => response.data),
  });
