// frontend/src/api/index.ts
import axios, { AxiosInstance } from 'axios';

export const API_BASE_URL = `${import.meta.env.VITE_API_URL}/v1`;

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const getAccessToken = () => sessionStorage.getItem('accessToken');
export const setAccessToken = (token: string) =>
  sessionStorage.setItem('accessToken', token);
export const removeAccessToken = () => sessionStorage.removeItem('accessToken');

// Request interceptor for API calls
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for API calls
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${API_BASE_URL}/refresh`,
          {},
          { withCredentials: true },
        );
        if (res.status === 200) {
          setAccessToken(res.data.access_token);
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token is invalid, logout the user
        removeAccessToken();
        // Redirect to login page or dispatch a logout action
      }
    }
    return Promise.reject(error);
  },
);

// Auth API
export const auth = {
  login: (email: string, password: string) =>
    api.post('/login', { email, password }),
  register: (userData: any) => api.post('/users', userData),
  loginSNS: (provider: string, accessToken: string) =>
    api.post(`/auth/login/${provider}`, { access_token: accessToken }),
  findEmail: (phoneNumber: string, birthdate: string) =>
    api.post('/auth/find-email', { phone_number: phoneNumber, birthdate }),
  requestPhoneVerification: (phoneNumber: string) =>
    api.post('/auth/phone-verification/request', { phone_number: phoneNumber }),
  verifyPhone: (phoneNumber: string, verificationCode: string) =>
    api.post('/auth/phone-verification/verify', {
      phone_number: phoneNumber,
      verification_code: verificationCode,
    }),
  resetPassword: (
    email: string,
    newPassword: string,
    newPasswordConfirmation: string,
  ) =>
    api.put('/auth/reset-password', {
      email,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    }),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
};

// User API
export const user = {
  register: (userData: any) => api.post('/users', userData),
  getMyInfo: () => api.get('/users/me'),
  updateMyInfo: (userData: any) => api.put('/users/me', userData),
  deleteAccount: (reason?: string, feedback?: string) =>
    api.delete('/users/me', { data: { reason, feedback } }),
  verifyPassword: (currentPassword: string) =>
    api.post('/users/me/password', { current_password: currentPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

// Chat API
export const chat = {
  sendMessage: (question: string, imageFile?: File) => {
    const formData = new FormData();
    formData.append('question', question);
    if (imageFile) {
      formData.append('image_file', imageFile);
    }
    return api.post('/chat', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getConversations: (
    page: number = 1,
    limit: number = 10,
    sort: string = 'question_time:desc',
    summary: boolean = false,
  ) => api.get('/conversations', { params: { page, limit, sort, summary } }),
  getConversationById: (conversationId: string) =>
    api.get(`/conversations/${conversationId}`),
  deleteConversation: (conversationId: string) =>
    api.delete(`/conversations/${conversationId}`),
};

// Token API
export const token = {
  getMyTokenInfo: () => api.get('/users/me/tokens'),
};

// Payment API
export const payment = {
  getProducts: () => api.get('/payments/products'),
  getProductById: (productId: string) =>
    api.get(`/payments/products/${productId}`),
  validateCoupon: (couponCode: string, productId: string) =>
    api.post('/payments/coupons/validate', {
      coupon_code: couponCode,
      product_id: productId,
    }),
  createPayment: (paymentData: any) => api.post('/payments', paymentData),
  getMyPayments: (page: number = 1, limit: number = 10) =>
    api.get('/users/me/payments', { params: { page, limit } }),
  getPaymentById: (paymentId: string) =>
    api.get(`/users/me/payments/${paymentId}`),
  cancelPayment: (paymentId: string, cancellationData: any) =>
    api.post(`/users/me/payments/${paymentId}/cancel`, cancellationData),
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
  createInquiry: (inquiryData: any) => api.post('/inquiries', inquiryData),
};

// Terms API
export const terms = {
  getTerms: () => api.get('/terms'),
  getTermsByType: (type: string) => api.get(`/terms/${type}`),
};

// Curator API
export const curator = {
  getCurators: (category?: string) =>
    api.get('/curators', { params: { category } }),
};

export default api;
