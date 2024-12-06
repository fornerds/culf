export const OAUTH = {
  KAKAO: {
    REST_API_KEY: `${process.env.KAKAO_CLIENT_ID}`,
    REDIRECT_URI: `${process.env.VITE_API_URL}/v1/auth/login/kakao`,
    AUTH_URL: 'https://kauth.kakao.com/oauth/authorize',
  },
  GOOGLE: {
    CLIENT_ID: `${process.env.GOOGLE_CLIENT_ID}`,
    REDIRECT_URI: `${process.env.VITE_API_URL}/v1/auth/login/google`,
    AUTH_URL: 'https://accounts.google.com/o/oauth2/auth',
  },
} as const;
