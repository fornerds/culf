import { useState, useEffect, useCallback } from 'react';
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
import { Notification } from './pages/Notification';
import { CustomerInquiry } from './pages/CustomerInquiry';
import logoimage from './assets/images/culf.png';
import axios from 'axios';
import { API_BASE_URL, auth } from './api';
import { OAuthCallback } from './pages/OAuthCallback';
import { tokenService } from './utils/tokenService';
import { useAuthStore } from './state/client/authStore';
import { LoadingAnimation } from './components/atom';
import { NoticeDetail } from './pages/Notification/Notice/[notice_id]';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      gcTime: 5 * 60 * 1000,
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

// 로그인한 사용자일 경우 홈으로 리다이렉트
const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const accessToken = tokenService.getAccessToken();
  return accessToken ? <Navigate to="/" replace /> : children;
};

// 인증 보호 기능을 추가한 PrivateOutlet 구성
export const PrivateOutlet = () => {
  const [isChecking, setIsChecking] = useState(true);
  const { setAuth } = useAuthStore();
  const accessToken = tokenService.getAccessToken();
  const { getUserInfo, isLoading } = useUser();
  const location = useLocation();

  useEffect(() => {
    let isActive = true;

    const validateAuth = async () => {
      try {
        // Terms 페이지이면서 SNS 로그인 진행 중인 경우 
        const loginStatus = document.cookie
          .split('; ')
          .find(row => row.startsWith('OAUTH_LOGIN_STATUS='))
          ?.split('=')[1];

        // SNS 회원가입 진행 중이면 검증 절차 건너뛰기
        if (loginStatus === 'continue') {
          if (process.env.NODE_ENV === 'development') {
            console.log('SNS Registration in progress, skipping auth check');
          }
          setIsChecking(false);
          return;
        }

        // access token이 있으면 해당 토큰으로 인증 시도
        if (accessToken) {
          try {
            await getUserInfo.refetch();
            if (isActive) {
              setAuth(true, getUserInfo.data || null);
            }
          } catch (error) {
            console.error('Failed to validate user:', error);
            if (isActive) {
              setAuth(false, null);
            }
          }
        } else {
          // access token이 없는 경우
          const hasRefreshToken = document.cookie
            .split('; ')
            .some(row => row.startsWith('refresh_token='));

          if (!hasRefreshToken) {
            // 리프레시 토큰도 없는 경우 인증 실패
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
  }, [location.pathname]);

  if (isChecking || isLoading) {
    return (
      <div style={{marginTop: "250px", display: "flex", alignItems: "center", flexDirection: "column", gap: "10px" }}>
        <LoadingAnimation
          imageUrl={logoimage}
          alt="Description"
          width={58}
          height={19}
          duration={2200} 
        />
        <p className='font-tag-1' style={{color: "#a1a1a1"}}>로그인 확인 중</p>
      </div>
    );
  }

  const loginStatus = document.cookie
    .split('; ')
    .find(row => row.startsWith('OAUTH_LOGIN_STATUS='))
    ?.split('=')[1];

  // SNS 회원가입 중이면 Terms 페이지 접근 허용
  if (loginStatus === 'continue' && location.pathname === '/terms') {
    return <Outlet />;
  }

  // access token이 있거나 SNS 인증 성공 상태면 접근 허용
  return (accessToken || loginStatus === 'success') ? <Outlet /> : <Navigate to="/login" replace />;
};

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
  const action = useNavigationType();
  const location = useLocation();
  const pathname = location.pathname;

  const handleMenuClick = useCallback(() => {
    console.log('Menu clicked in App.tsx');
    toggle();
  }, [toggle]);

  useEffect(() => {
    setOnMenuClick(handleMenuClick);
  }, [setOnMenuClick, handleMenuClick]);

  useEffect(() => {
    console.log('App effect, SideMenu isOpen:', isOpen);
  }, [isOpen]);

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
    } else if (matchPath('/notification/my-notice/:notice_id', pathname)) {
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

    console.log('Header state updated:', {
      pathname,
      useHeader: useHeaderStore.getState().useHeader,
      showMenuButton: useHeaderStore.getState().showMenuButton,
    });
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
          <Route index element={<Navigate to="/notification/notice" replace />} />
          <Route path="notice" element={<Notification />} />
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
          <Route path="/cancel-payment/:payment_id" element={<CancelPayment />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="/notification/:tab" element={<Notification />} />
        </Route>
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/beta">
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;