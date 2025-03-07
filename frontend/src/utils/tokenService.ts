const TOKEN_KEY = 'access_token';

class TokenService {
  // 액세스 토큰 저장
  setAccessToken(token: string): void {
    if (!token) {
      console.warn('토큰이 비어있습니다.');
      return;
    }

    try {
      // localStorage 대신 sessionStorage 사용
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('토큰 저장 실패:', error);
    }
  }

  // 액세스 토큰 가져오기
  getAccessToken(): string | null {
    try {
      // localStorage 대신 sessionStorage에서 가져오기
      return sessionStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('토큰 조회 실패:', error);
      return null;
    }
  }

  // 액세스 토큰 제거
  removeAccessToken(): void {
    try {
      // localStorage 대신 sessionStorage에서 제거
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('토큰 삭제 실패:', error);
    }
  }

  // 토큰이 있는지 확인
  hasToken(): boolean {
    return !!this.getAccessToken();
  }

  // 토큰이 만료되었는지 확인 (간단한 구현)
  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    try {
      // JWT 토큰 디코딩
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      // 만료 시간 확인
      const now = Date.now() / 1000;
      return payload.exp < now;
    } catch (error) {
      console.error('토큰 만료 확인 실패:', error);
      return true; // 오류 발생 시 만료된 것으로 간주
    }
  }

  // 세션 지속 확인 (디버깅용)
  checkSession(): void {
    console.log('현재 세션에 토큰 존재 여부:', this.hasToken());
  }
}

export const tokenService = new TokenService();
