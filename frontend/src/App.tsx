import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Routes,
  Route,
  useNavigationType,
  useLocation,
  matchPath,
  Navigate,
  BrowserRouter,
  Outlet,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHeaderStore } from './state/client/useHeaderStore';
import { useSideMenuStore } from './state/client/useSideMenuStore';
import { useUser } from './hooks/user/useUser';
import { tokenService } from './utils/tokenService';
import { useAuthStore } from './state/client/authStore';
import { LoadingAnimation } from './components/atom';

// 페이지 임포트
import { Homepage } from './pages/Homepage';
import { Mypage } from './pages/Mypage';
import { Login } from './pages/Login';
import { Layout } from './components/organism/Layout';
import { Terms } from './pages/Terms';
import { Signup } from './pages/Signup';
import { CompleteSignup } from './pages/CompleteSignup';
import { FindEmail } from './pages/FindEmail';
import { ChangePassword } from './pages/ChangePassword';
import { Chat, ChatDetail } from './pages/Chat';
import { Pricing } from './pages/Pricing';
import { Payment, Result } from './pages/Payment';
import { CancelPayment } from './pages/CancelPayment/[payment_id]';
import { DeleteAccount } from './pages/DeleteAccount';
import {
  PublicNotification,
  PrivateNotification,
  NoticeDetail,
  NotificationDetail,
} from './pages/Notification';
import { CustomerInquiry } from './pages/CustomerInquiry';
import logoimage from './assets/images/culf.png';
import { auth } from './api';
import { OAuthCallback } from './pages/OAuthCallback';

// 전역 QueryClient 생성 및 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      gcTime: 5 * 60 * 1000,
      staleTime: 1 * 60 * 1000, // 1분으로 단축하여 더 자주 업데이트
    },
    mutations: {
      retry: false,
    },
  },
});

// 로그인한 사용자일 경우 홈으로 리다이렉트하는 공개 라우트
const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const accessToken = tokenService.getAccessToken();
  return accessToken ? <Navigate to="/" replace /> : children;
};

// 인증 상태를 확인하는 개선된 PrivateOutlet
export const PrivateOutlet = () => {
  const [isChecking, setIsChecking] = useState(true);
  const { setAuth } = useAuthStore();
  const location = useLocation();
  const accessToken = tokenService.getAccessToken();

  useEffect(() => {
    let isActive = true;

    const validateAuth = async () => {
      try {
        // SNS 로그인 진행 중 확인
        const loginStatus = document.cookie
          .split('; ')
          .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
          ?.split('=')[1];

        // SNS 회원가입 진행 중이면 검증 절차 건너뛰기
        if (loginStatus === 'continue' && location.pathname === '/terms') {
          setIsChecking(false);
          return;
        }

        // 토큰이 있는 경우
        if (accessToken) {
          try {
            // 서버에서 현재 사용자 정보 가져오기
            const userResponse = await auth.refreshToken();
            if (isActive && userResponse.data && userResponse.data.user) {
              const { access_token, user } = userResponse.data;
              // 인증 상태 및 토큰 업데이트
              tokenService.setAccessToken(access_token);
              setAuth(true, user, access_token);

              // 사용자 정보 캐시 초기화
              queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            }
          } catch (error) {
            console.error('Failed to validate user:', error);
            if (isActive) {
              tokenService.removeAccessToken();
              setAuth(false, null);
            }
          }
        } else {
          // 액세스 토큰이 없는 경우 리프레시 토큰 확인
          const hasRefreshToken = document.cookie
            .split('; ')
            .some((row) => row.startsWith('refresh_token='));

          if (hasRefreshToken) {
            // 리프레시 토큰으로 새 액세스 토큰 요청
            try {
              const refreshResponse = await auth.refreshToken();
              if (
                isActive &&
                refreshResponse.data &&
                refreshResponse.data.access_token
              ) {
                const { access_token, user } = refreshResponse.data;
                tokenService.setAccessToken(access_token);
                setAuth(true, user, access_token);

                // 사용자 정보 캐시 초기화
                queryClient.invalidateQueries({ queryKey: ['userInfo'] });
              }
            } catch (refreshError) {
              console.error('Refresh token failed:', refreshError);
              if (isActive) {
                setAuth(false, null);
              }
            }
          } else {
            // 토큰이 전혀 없는 경우 인증 실패 처리
            if (isActive) {
              setAuth(false, null);
            }
          }
        }
      } catch (error) {
        console.error('Auth validation failed:', error);
        if (isActive) {
          setAuth(false, null);
        }
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    };

    validateAuth();

    return () => {
      isActive = false;
    };
  }, [location.pathname, accessToken]);

  // 로딩 상태 표시
  if (isChecking) {
    return (
      <div
        style={{
          marginTop: '250px',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <LoadingAnimation
          imageUrl={logoimage}
          alt="Description"
          width={58}
          height={19}
          duration={2200}
        />
        <p className="font-tag-1" style={{ color: '#a1a1a1' }}>
          로그인 확인 중
        </p>
      </div>
    );
  }

  // SNS 회원가입 확인
  const loginStatus = document.cookie
    .split('; ')
    .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
    ?.split('=')[1];

  // SNS 회원가입 중이면 Terms 페이지 접근 허용
  if (loginStatus === 'continue' && location.pathname === '/terms') {
    return <Outlet />;
  }

  // 인증 확인 후 접근 허용 또는 로그인 페이지로 리다이렉트
  return accessToken || loginStatus === 'success' ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
};

// 라우트 설정을 담당하는 컴포넌트
function AppRoutes() {
  const {
    setUseHeader,
    setTitle,
    setShowBackButton,
    setShowMenuButton,
    setOnMenuClick,
    resetHeader,
  } = useHeaderStore();
  const { isOpen, toggle } = useSideMenuStore();
  const location = useLocation();
  const pathname = location.pathname;

  // 메뉴 버튼 클릭 핸들러
  const handleMenuClick = useCallback(() => {
    toggle();
  }, [toggle]);

  // 메뉴 버튼 클릭 이벤트 설정
  useEffect(() => {
    setOnMenuClick(handleMenuClick);
  }, [setOnMenuClick, handleMenuClick]);

  // 페이지별 헤더 설정
  useEffect(() => {
    resetHeader();

    if (matchPath('/', pathname)) {
      setUseHeader(true);
      setTitle(<img src={logoimage} alt="로고" width="54" height="19" />);
      setShowBackButton(false);
      setShowMenuButton(true);
    } else if (matchPath('/login', pathname)) {
      setUseHeader(true);
      setTitle(<img src={logoimage} alt="로고" width="54" height="19" />);
      setShowBackButton(false);
      setShowMenuButton(false);
    } else if (matchPath('/terms', pathname)) {
      setUseHeader(true);
      setTitle('회원가입');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/signup', pathname)) {
      setUseHeader(true);
      setTitle('회원가입');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/find-email', pathname)) {
      setUseHeader(true);
      setTitle('이메일 찾기');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/change-password', pathname)) {
      setUseHeader(true);
      setTitle('비밀번호 찾기');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/mypage/:tab', pathname)) {
      setUseHeader(true);
      setTitle('마이페이지');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/chat/:chat_id', pathname)) {
      setUseHeader(true);
      setTitle('컬프 베타');
      setShowBackButton(true);
      setShowMenuButton(true);
    } else if (matchPath('/notification/:tab', pathname)) {
      setUseHeader(true);
      setTitle('알림');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/notification/notice/:notice_id', pathname)) {
      setUseHeader(true);
      setTitle('알림 상세');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (
      matchPath('/notification/my-notice/:notification_id', pathname)
    ) {
      setUseHeader(true);
      setTitle('알림 상세');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/inquiry', pathname)) {
      setUseHeader(true);
      setTitle('문의하기');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/pricing', pathname)) {
      setUseHeader(true);
      setTitle('서비스결제');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/payment/:type/:id', pathname)) {
      setUseHeader(true);
      setTitle('서비스결제');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/payment/result', pathname)) {
      setUseHeader(true);
      setTitle('결제 메시지');
      setShowBackButton(false);
      setShowMenuButton(false);
    } else if (matchPath('/cancel-payment/:payment_id', pathname)) {
      setUseHeader(true);
      setTitle('취소 요청');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else if (matchPath('/delete-account', pathname)) {
      setUseHeader(true);
      setTitle('계정 탈퇴');
      setShowBackButton(true);
      setShowMenuButton(false);
    } else {
      setUseHeader(false);
    }
  }, [
    pathname,
    setUseHeader,
    setTitle,
    setShowBackButton,
    setShowMenuButton,
    resetHeader,
  ]);

  return (
    <Layout>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/" element={<Homepage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/complete-signup" element={<CompleteSignup />} />
        <Route path="/find-email" element={<FindEmail />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/inquiry" element={<CustomerInquiry />} />
        <Route path="/notification">
          <Route
            index
            element={<Navigate to="/notification/notice" replace />}
          />
          <Route path="notice" element={<PublicNotification />} />
          <Route path="notice/:notice_id" element={<NoticeDetail />} />
        </Route>

        {/* 인증이 필요한 라우트 */}
        <Route element={<PrivateOutlet />}>
          <Route
            path="/mypage"
            element={<Navigate to="/mypage/account" replace />}
          />
          <Route path="/mypage/:tab" element={<Mypage />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:roomId" element={<ChatDetail />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/payment/:type/:id" element={<Payment />} />
          <Route path="/payment/result" element={<Result />} />
          <Route
            path="/cancel-payment/:payment_id"
            element={<CancelPayment />}
          />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route
            path="/notification/my-notice"
            element={<PrivateNotification />}
          />
          <Route
            path="/notification/my-notice/:notification_id"
            element={<NotificationDetail />}
          />
        </Route>
      </Routes>
    </Layout>
  );
}

// App 컴포넌트 - 앱의 최상위 컴포넌트
function App() {
  // 앱 초기화 시 AuthStore에 QueryClient 설정
  useEffect(() => {
    useAuthStore.getState().setQueryClient(queryClient);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/">
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
