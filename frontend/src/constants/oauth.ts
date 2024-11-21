export const OAUTH = {
  KAKAO: {
    REST_API_KEY: `${process.env.KAKAO_CLIENT_ID}`,
    REDIRECT_URI: `${window.location.origin}/v1/auth/callback/kakao`,
    AUTH_URL: 'https://kauth.kakao.com/oauth/authorize',
    getAuthUrl: function () {
      const params = new URLSearchParams({
        client_id: this.REST_API_KEY,
        redirect_uri: this.REDIRECT_URI,
        response_type: 'code',
      });
      return `${this.AUTH_URL}?${params.toString()}`;
    },
  },
  GOOGLE: {
    REST_API_KEY: `${process.env.GOOGLE_CLIENT_ID}`,
    REDIRECT_URI: `${window.location.origin}/v1/auth/callback/google`,
    AUTH_URL: 'https://accounts.google.com/o/oauth2/auth',
    getAuthUrl: function () {
      const params = new URLSearchParams({
        client_id: this.REST_API_KEY,
        redirect_uri: this.REDIRECT_URI,
        response_type: 'code',
      });
      return `${this.AUTH_URL}?${params.toString()}`;
    },
  },
} as const;
