export const tokenService = {
  getAccessToken: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    return token;
  },

  setAccessToken: (token: string) => {
    if (!token) {
      localStorage.removeItem('accessToken');
      return;
    }
    localStorage.setItem('accessToken', token);
  },

  removeAccessToken: () => {
    localStorage.removeItem('accessToken');
  },

  isValidToken: () => {
    const token = tokenService.getAccessToken();
    if (!token) return false;
    // 여기서 토큰 유효성 검사 로직을 추가할 수 있습니다
    return true;
  }
};