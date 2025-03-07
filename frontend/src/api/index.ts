// api/index.ts
import axios, { AxiosInstance } from 'axios';
import { tokenService } from '@/utils/tokenService';
import { useAuthStore } from '../state/client/authStore';
import { PAYMENT_CONFIG } from '@/config/payment';

interface PaymentData {
  plan_id: number;
  pg: string;
  pay_method?: string;
  coupon_code?: string;
}

interface CleanedPaymentData {
  plan_id: number;
  pg: string;
  pay_method?: string;
  coupon_code?: string;
}

export const API_BASE_URL = `${import.meta.env.VITE_API_URL}/v1`;

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 단순화된 request 인터셉터
export const setupRequestInterceptor = () => {
  api.interceptors.request.use(
    (config) => {
      // 모든 요청에 토큰 추가
      const token = tokenService.getAccessToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );
};

// 단순화된 response 인터셉터 - 로직을 더 명확하게
export const setupResponseInterceptor = () => {
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // 인증 관련 오류 (401)만 특별 처리
      if (error.response?.status === 401 && !originalRequest._retry) {
        // 리프레시 토큰 존재 확인
        const hasRefreshToken = document.cookie
          .split('; ')
          .some((row) => row.startsWith('refresh_token='));

        if (!hasRefreshToken) {
          // 리프레시 토큰이 없으면 로그아웃 처리
          console.log('No refresh token, logging out');
          tokenService.removeAccessToken();
          useAuthStore.getState().setAuth(false, null);

          // 로그인이 필요한 페이지에서만 리다이렉트
          if (
            !window.location.pathname.includes('/login') &&
            window.location.pathname !== '/' &&
            !window.location.pathname.includes('/notification/notice')
          ) {
            window.location.href = '/login';
          }

          return Promise.reject(error);
        }

        // 토큰 갱신 시도
        originalRequest._retry = true;

        try {
          console.log('Attempting to refresh token...');
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { withCredentials: true },
          );

          if (response.data && response.data.access_token) {
            // 새 토큰 저장
            const { access_token, user } = response.data;
            tokenService.setAccessToken(access_token);

            // 인증 상태 업데이트
            useAuthStore.getState().setAuth(true, user, access_token);

            // 원래 요청의 헤더 업데이트
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

            // 원래 요청 재시도
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);

          // 토큰 갱신 실패 시 로그아웃 처리
          tokenService.removeAccessToken();
          useAuthStore.getState().setAuth(false, null);

          // 로그인이 필요한 페이지에서만 리다이렉트
          if (
            !window.location.pathname.includes('/login') &&
            window.location.pathname !== '/' &&
            !window.location.pathname.includes('/notification/notice')
          ) {
            window.location.href = '/login';
          }
        }
      }

      // 기타 모든 오류는 그대로 반환
      return Promise.reject(error);
    },
  );
};

// Banner
export const banner = {
  getBanners: () => api.get('/banners'),
};

// Auth API
export const auth = {
  login: async (email: string, password: string) => {
    console.log('로그인 요청:', { email });

    // 기존 토큰을 먼저 제거하여 인증 초기화
    tokenService.removeAccessToken();

    try {
      const response = await api.post('/auth/login', { email, password });

      // 토큰 및 사용자 정보 확인
      if (response.data && response.data.access_token) {
        console.log('로그인 성공, 토큰 수신');
        return response;
      } else {
        console.error('로그인 응답에 토큰이 없음:', response.data);
        throw new Error('로그인 응답에 토큰이 없습니다.');
      }
    } catch (error) {
      console.error('로그인 API 호출 오류:', error);
      throw error;
    }
  },

  logout: async () => {
    console.log('로그아웃 요청');
    try {
      await api.post('/logout');
      console.log('로그아웃 API 성공');
    } catch (error) {
      console.error('로그아웃 API 오류(무시):', error);
    } finally {
      // API 성공 여부와 관계없이 클라이언트 상태 초기화
      tokenService.removeAccessToken();
      useAuthStore.getState().setAuth(false, null);
      useAuthStore.getState().resetSnsAuth?.();
      console.log('로그아웃 및 상태 초기화 완료');
    }
  },

  register: (userData: any) => {
    console.log('회원가입 요청');
    const providerInfo = document.cookie
      .split('; ')
      .find((row) => row.startsWith('provider_info='))
      ?.split('=')[1];

    return api.post('/auth/register', userData, {
      headers: providerInfo
        ? {
            provider_info: providerInfo,
          }
        : undefined,
      withCredentials: true,
    });
  },

  refreshToken: async () => {
    console.log('토큰 리프레시 요청');
    try {
      // 리프레시 토큰으로 새 액세스 토큰 요청
      const response = await api.post(
        '/auth/refresh',
        {},
        {
          withCredentials: true,
        },
      );

      // 새 토큰이 있으면 저장
      if (response.data && response.data.access_token) {
        tokenService.setAccessToken(response.data.access_token);
        console.log('새 액세스 토큰 저장 완료');
      } else {
        console.warn('리프레시 응답에 액세스 토큰이 없음:', response.data);
      }

      return response;
    } catch (error) {
      console.error('토큰 리프레시 실패:', error);
      // 리프레시 실패 시 기존 토큰 제거
      tokenService.removeAccessToken();
      throw error;
    }
  },

  loginSNS: (provider: string, accessToken: string) => {
    console.log('SNS 로그인 요청:', provider);
    return api.post(`/auth/login/${provider}`, { access_token: accessToken });
  },

  // 나머지 메서드는 그대로 유지...
  findEmail: (phoneNumber: string, birthdate: string) =>
    api.post('/auth/find-email', { phone_number: phoneNumber, birthdate }),

  requestPhoneVerification: (phoneNumber: string, findPw: boolean) =>
    api.post('/auth/phone-verification/request', {
      phone_number: phoneNumber,
      findpw: findPw,
    }),

  verifyPhone: (phoneNumber: string, verificationCode: string) =>
    api.post('/auth/phone-verification/verify', {
      phone_number: phoneNumber,
      verification_code: verificationCode,
    }),

  resetPassword: (
    email: string,
    phoneNumber: string,
    newPassword: string,
    newPasswordConfirm: string,
  ) =>
    api.post('/auth/reset-password', {
      email,
      phone_number: phoneNumber,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    }),

  getProviderEmail: async () => {
    const providerInfo = document.cookie
      .split('; ')
      .find((row) => row.startsWith('provider_info='))
      ?.split('=')[1];

    if (!providerInfo) {
      throw new Error('Provider info not found in cookies');
    }

    return api.get('/auth/provider_email', {
      headers: {
        provider_info: providerInfo,
      },
      withCredentials: true,
    });
  },

  processCallback: (provider: string, code: string) =>
    api.get(`/auth/login/${provider}`, {
      params: { code },
      withCredentials: true,
    }),
};

// User API
export const user = {
  getMyInfo: () => api.get('/users/me'),
  updateMyInfo: (userData: any) => api.put('/users/me', userData),
  deleteAccount: (reason?: string, feedback?: string) =>
    api.delete('/users/me', { data: { reason, feedback } }),
  verifyPassword: (current_password: string) =>
    api.post('/users/me/password', {
      current_password: current_password,
    }),
  changePassword: (new_password: string, new_password_confirm: string) =>
    api.put('/users/me/password', {
      new_password,
      new_password_confirm,
    }),
};

// Chat API
export const chat = {
  sendMessage: async (
    formData: FormData,
    onMessage?: (message: string) => void,
  ): Promise<any> => {
    try {
      const token = tokenService.getAccessToken();
      if (!token) {
        throw new Error('Authorization token is missing');
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error('스톤이 부족합니다. 스톤을 충전해주세요.');
        } else if (response.status === 404) {
          throw new Error('Chat room not found');
        } else if (response.status === 500) {
          throw new Error(
            'Internal server error occurred. Please try again later.',
          );
        } else {
          throw new Error(
            `Chat API Error: ${response.status}` +
              (errorData.detail
                ? `, Details: ${JSON.stringify(errorData.detail)}`
                : ''),
          );
        }
      }

      const data = await response.json();
      console.log('Chat API Response:', data);

      if (!onMessage || !data.answer) {
        return data;
      }

      const text = data.answer;
      let isCancelled = false;
      let currentIndex = 0;

      return new Promise((resolve) => {
        const streamText = () => {
          if (isCancelled) {
            resolve(() => {
              isCancelled = true;
            });
            return;
          }

          if (currentIndex < text.length) {
            let endIndex = currentIndex + 2;
            while (
              endIndex < text.length &&
              !text[endIndex - 1].match(/[\s\n.!?,;:]/)
            ) {
              endIndex++;
            }

            const chunk = text.slice(currentIndex, endIndex);
            onMessage(chunk);
            currentIndex = endIndex;

            const lastChar = chunk[chunk.length - 1];
            const delay = lastChar?.match(/[.!?]/)
              ? 300
              : lastChar?.match(/[,;:]/)
                ? 200
                : lastChar?.match(/\s/)
                  ? 100
                  : 50;

            setTimeout(streamText, delay);
          } else {
            resolve({
              conversation_id: data.conversation_id,
              answer: data.answer,
              tokens_used: data.tokens_used,
              recommended_questions: data.recommended_questions,
            });
          }
        };

        streamText();
      });
    } catch (error) {
      console.error('Chat API Error:', error);
      throw error;
    }
  },

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getConversations: (
    page: number = 1,
    limit: number = 10,
    sort: string = 'question_time:desc',
    summary: boolean = false,
    userId?: string,
    searchQuery?: string,
  ) => {
    return api.get('/conversations', {
      params: {
        page,
        limit,
        sort,
        summary,
        user_id: userId,
        search_query: searchQuery,
      },
    });
  },

  getConversationById: (conversationId: string) =>
    api.get(`/conversations/${conversationId}`),

  deleteConversation: (conversationId: string) =>
    api.delete(`/conversations/${conversationId}`),

  getChatRooms: () => api.get('/chat-rooms'),

  createChatRoom: (curatorId: number, title?: string) =>
    api.post('/chat-rooms', { curator_id: curatorId, title }),

  getChatRoomById: (roomId: string) => api.get(`/chat-rooms/${roomId}`),

  deleteChatRoom: (roomId: string) => api.delete(`/chat-rooms/${roomId}`),

  getChatRoomCurator: (roomId: string) =>
    api.get(`/chat-rooms/${roomId}/curator`),
};

// Token API
export const token = {
  getMyTokenInfo: () => api.get('/users/me/tokens'),
};

// Payment API
export const payment = {
  getProducts: () => api.get('/payments/products'),
  getProductById: (productId: string, productType: 'subscription' | 'token') =>
    api.get(`/payments/products/${productId}`, {
      params: { product_type: productType },
    }),
  validateCoupon: (couponCode: string) =>
    api.post('/payments/coupons/validate', {
      coupon_code: couponCode,
    }),
  createPayment: (paymentData: any) => api.post('/payments', paymentData),
  createSinglePayment: (paymentData: PaymentData) => {
    if (!paymentData.plan_id || !paymentData.pg) {
      throw new Error('필수 결제 정보가 누락되었습니다.');
    }

    // 다날 결제의 경우 pay_method 필수
    if (
      paymentData.pg === PAYMENT_CONFIG.pgProviders.DANAL &&
      !paymentData.pay_method
    ) {
      throw new Error('휴대폰 결제 방식이 선택되지 않았습니다.');
    }

    const cleanedData: CleanedPaymentData = {
      plan_id: Number(paymentData.plan_id),
      pg: paymentData.pg,
      pay_method: paymentData.pay_method,
      ...(paymentData.coupon_code && { coupon_code: paymentData.coupon_code }),
    };

    // 불필요한 undefined 값 제거
    const finalData: CleanedPaymentData = Object.fromEntries(
      Object.entries(cleanedData).filter(([_, value]) => value !== undefined),
    ) as CleanedPaymentData;

    console.log('Cleaned payment data:', finalData);

    return api.post('/portone/payment', finalData);
  },

  createSubscription: (subscriptionData: PaymentData) => {
    if (!subscriptionData.plan_id || !subscriptionData.pg) {
      throw new Error('필수 결제 정보가 누락되었습니다.');
    }

    const cleanedData: CleanedPaymentData = {
      plan_id: Number(subscriptionData.plan_id),
      pg: subscriptionData.pg,
      pay_method: subscriptionData.pay_method,
      ...(subscriptionData.coupon_code && {
        coupon_code: subscriptionData.coupon_code,
      }),
    };

    // 불필요한 undefined 값 제거
    const finalData: CleanedPaymentData = Object.fromEntries(
      Object.entries(cleanedData).filter(([_, value]) => value !== undefined),
    ) as CleanedPaymentData;

    console.log('Cleaned subscription data:', finalData);

    return api.post('/portone/subscription', finalData);
  },

  getMyPayments: (page: number = 1, limit: number = 10) =>
    api.get('/users/me/payments', { params: { page, limit } }),
  getPaymentById: (paymentId: string) =>
    api.get(`/users/me/payments/${paymentId}`),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  cancelPayment: (paymentId: string, formData: FormData) => {
    return api.post(`/users/me/payments/${paymentId}/cancel`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  verifyPayment: (verificationData: {
    imp_uid: string;
    merchant_uid: string;
  }) => {
    return api.post('/payment-complete', verificationData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenService.getAccessToken()}`,
      },
    });
  },
};

// Subscription API
export const subscription = {
  getMySubscription: () => api.get('/users/me/subscriptions'),
  isSubscribed: () => api.get('/users/me/subscribed'),
  changeSubscription: (planId: number) =>
    api.put('/users/me/subscriptions', { plan_id: planId }),
  cancelSubscription: () => api.delete('/users/me/subscriptions'),
};

// Notification API
export const notification = {
  getMyNotifications: (page: number = 1, limit: number = 10) =>
    api.get('/users/me/notifications', { params: { page, limit } }),
  getNotificationById: (notificationId: number) =>
    api.get(`/users/me/notifications/${notificationId}`),
  markNotificationAsRead: (notificationId: number) =>
    api.put(`/users/me/notifications/${notificationId}/read`),
  updateNotificationSettings: (settings: any) =>
    api.put('/users/me/notification-settings', settings),
};

// Notice API
export const notice = {
  getNotices: (page: number = 1, limit: number = 10) =>
    api.get('/notices', { params: { page, limit } }),
  getNoticeById: (noticeId: number) => api.get(`/notices/${noticeId}`),
};

// Inquiry API
export const inquiry = {
  createInquiry: (inquiryData: FormData) => {
    return api.post('/inquiries', inquiryData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Terms API
export const terms = {
  getTerms: () => api.get('/terms'),
  getTermsByType: (type: string) => api.get(`/terms/${type}`),
};

// Curator API
export const curator = {
  getCurators: (category?: string, tag?: string) =>
    api.get('/curators', {
      params: {
        category,
        tag,
      },
    }),
};

// Footer API
export const footer = {
  getFooter: () => api.get('/footer'),
};

export default api;
