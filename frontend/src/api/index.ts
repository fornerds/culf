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

// Request interceptor
api.interceptors.request.use(
  (config) => {
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

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // pathname이 '/'인 경우에는 401 에러를 무시하고 진행
    if (window.location.pathname === '/' && error.response?.status === 401) {
      return Promise.reject(error);
    }

    // 401 에러이고 토큰 갱신 시도를 하지 않은 경우에만 갱신 시도
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // 기존 상태 초기화
        tokenService.removeAccessToken();
        useAuthStore.getState().setAuth(false, null);
        
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
          },
        );

        if (res.status === 200 && res.data.access_token) {
          // 새로운 토큰으로 갱신
          tokenService.setAccessToken(res.data.access_token);
          originalRequest.headers['Authorization'] = `Bearer ${res.data.access_token}`;
          
          // 새로운 토큰으로 원래 요청 재시도
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // 토큰 갱신 실패 시 로그인 페이지로 리다이렉트 (홈페이지 제외)
        tokenService.removeAccessToken();
        useAuthStore.getState().setAuth(false, null);
        useAuthStore.getState().resetSnsAuth?.();
        
        // 현재 URL이 로그인 페이지나 홈페이지가 아닌 경우에만 리다이렉트
        if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
          window.location.href = '/beta/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

// Banner
export const banner = {
  getBanners: () => api.get('/banners'),
};

// Auth API
export const auth = {
  login: (email: string, password: string) => {
    // 로그인 전에 기존 토큰과 상태 초기화
    tokenService.removeAccessToken();
    useAuthStore.getState().setAuth(false, null);
    
    return api.post('/auth/login', { email, password });
  },

  logout: async () => {
    try {
      await api.post('/logout');
    } finally {
      // 로그아웃 API 호출 결과와 관계없이 클라이언트 상태 초기화
      tokenService.removeAccessToken();
      useAuthStore.getState().setAuth(false, null);
      useAuthStore.getState().resetSnsAuth?.();
    }
  },

  register: (userData: any) => {
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
    // 기존 토큰 제거
    tokenService.removeAccessToken();
    
    const response = await api.post('/auth/refresh', {}, { 
      withCredentials: true 
    });
    
    if (response.data.access_token) {
      tokenService.setAccessToken(response.data.access_token);
    }
    
    return response;
  },

  loginSNS: (provider: string, accessToken: string) =>
    api.post(`/auth/login/${provider}`, { access_token: accessToken }),

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
      current_password: current_password 
    }),
  changePassword: (new_password: string, new_password_confirm: string) =>
    api.put('/users/me/password', {
      new_password,
      new_password_confirm
    }),
};


// Chat API
export const chat = {
  sendMessage: async (
    formData: FormData,
    onMessage?: (message: string) => void
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
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error('스톤이 부족합니다. 스톤을 충전해주세요.');
        } else if (response.status === 404) {
          throw new Error('Chat room not found');
        } else if (response.status === 500) {
          throw new Error('Internal server error occurred. Please try again later.');
        } else {
          throw new Error(
            `Chat API Error: ${response.status}` +
            (errorData.detail ? `, Details: ${JSON.stringify(errorData.detail)}` : '')
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
            resolve(() => { isCancelled = true; });
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
              recommended_questions: data.recommended_questions
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

  getChatRoomCurator: (roomId: string) =>
    api.get(`/chat-rooms/${roomId}/curator`),
};

// Token API
export const token = {
  getMyTokenInfo: () => api.get('/me/tokens'),
};

// Payment API
export const payment = {
  getProducts: () => api.get('/payments/products'),
  getProductById: (productId: string, productType: 'subscription' | 'token') =>
    api.get(`/payments/products/${productId}`, {
      params: { product_type: productType }
    }),
    validateCoupon: (couponCode: string) =>
    api.post('/payments/coupons/validate', {
      coupon_code: couponCode
    }),
  createPayment: (paymentData: any) => api.post('/payments', paymentData),
  createSinglePayment: (paymentData: PaymentData) => {
    if (!paymentData.plan_id || !paymentData.pg) {
      throw new Error('필수 결제 정보가 누락되었습니다.');
    }

    // 다날 결제의 경우 pay_method 필수
    if (paymentData.pg === PAYMENT_CONFIG.pgProviders.DANAL && !paymentData.pay_method) {
      throw new Error('휴대폰 결제 방식이 선택되지 않았습니다.');
    }

    const cleanedData: CleanedPaymentData = {
      plan_id: Number(paymentData.plan_id),
      pg: paymentData.pg,
      pay_method: paymentData.pay_method,
      ...(paymentData.coupon_code && { coupon_code: paymentData.coupon_code })
    };

    // 불필요한 undefined 값 제거
    const finalData: CleanedPaymentData = Object.fromEntries(
      Object.entries(cleanedData).filter(([_, value]) => value !== undefined)
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
      ...(subscriptionData.coupon_code && { coupon_code: subscriptionData.coupon_code })
    };

    // 불필요한 undefined 값 제거
    const finalData: CleanedPaymentData = Object.fromEntries(
      Object.entries(cleanedData).filter(([_, value]) => value !== undefined)
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
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  cancelPayment: (paymentId: string, formData: FormData) => {
    return api.post(`/users/me/payments/${paymentId}/cancel`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  verifyPayment: (verificationData: { imp_uid: string; merchant_uid: string }) => {
    return api.post('/payment-complete', verificationData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenService.getAccessToken()}`
      }
    });
  },
};

// Subscription API
export const subscription = {
  getMySubscription: () => api.get('/users/me/subscriptions'),
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
        'Content-Type': 'multipart/form-data'
      }
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
        tag 
      } 
    }),
};

export default api;