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
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useHeaderStore } from './state/client/useHeaderStore';
import { useSideMenuStore } from './state/client/useSideMenuStore';

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
import { Payment } from './pages/Payment';
import { CancelPayment } from './pages/CancelPayment';
import { DeleteAccount } from './pages/DeleteAccount';
import { Notification } from './pages/Notification';
import { CustomerInquiry } from './pages/CustomerInquiry';
import logoimage from './assets/images/culf.png';
import axios from 'axios';
import { API_BASE_URL, auth, user } from './api';
import { OAuthCallback } from './pages/OAuthCallback';
import { tokenService } from './utils/tokenService';
import { useAuthStore } from './state/client/authStore';
import { LoadingAnimation } from './components/atom';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      gcTime: 5 * 60 * 1000, // 5분 (이전의 cacheTime)
      staleTime: 5 * 60 * 1000, // 5분
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

const refreshAccessToken = async () => {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/refresh`,
      {},
      { withCredentials: true },
    );
    tokenService.setAccessToken(res.data.access_token);
    return true;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return false;
  }
};

// 인증 보호 기능을 추가한 PrivateRoute 구성
export const PrivateOutlet = () => {
  const [isChecking, setIsChecking] = useState(true);
  const { setAuth } = useAuthStore();
  const accessToken = tokenService.getAccessToken();

  useEffect(() => {
    const validateAuth = async () => {
      try {
        if (!accessToken) {
          // Try to refresh token if no access token
          const response = await auth.refreshToken();
          if (response.data.access_token) {
            tokenService.setAccessToken(response.data.access_token);
            setAuth(true, response.data.user);
            setIsChecking(false);
            return;
          }
        } else {
          // Validate existing access token
          const response = await user.getMyInfo();
          setAuth(true, response.data);
          setIsChecking(false);
          return;
        }
      } catch (error) {
        console.error('Auth validation failed:', error);
      }

      setAuth(false, null);
      setIsChecking(false);
    };

    validateAuth();
  }, [accessToken, setAuth]);

  if (isChecking) {
    return <div style={{marginTop: "250px", display: "flex", alignItems: "center", flexDirection: "column", gap: "10px" }}>
      <LoadingAnimation
        imageUrl={logoimage}
        alt="Description"
        width={58}
        height={19}
        duration={2200} 
      />
      <p className='font-tag-1' style={{color: "#a1a1a1"}}>로그인 확인 중</p>
    </div>;
  }

  return accessToken ? <Outlet /> : <Navigate to="/login" replace />;
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
      setShowMenuButton(!!tokenService.getAccessToken());
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
    } else if (matchPath('/notification', pathname)) {
      setUseHeader(true);
      setTitle('알림');
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
    } else if (matchPath('/cancel-payment', pathname)) {
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
    }); // Debug log
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
        <Route element={<PrivateOutlet />}>
          <Route
            path="/mypage"
            element={<Navigate to="/mypage/account" replace />}
          />
          <Route path="/mypage/:tab" element={<Mypage />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:chat_id" element={<ChatDetail />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/cancel-payment" element={<CancelPayment />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="/inquiry" element={<CustomerInquiry />} />
          <Route path="/notification" element={<Notification />} />
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
      {/* {import.meta.env.MODE === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )} */}
    </QueryClientProvider>
  );
}

export default App;
