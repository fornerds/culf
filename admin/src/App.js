import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import './scss/style.scss'
import httpClient from './api/httpClient'

const loading = (
  <div className="pt-3 text-center">
    <div className="sk-spinner sk-spinner-pulse"></div>
  </div>
)

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// Pages
const Login = React.lazy(() => import('./views/pages/login/Login'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

const App = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    // 페이지 로드 시 토큰 확인 및 로그인 상태 복원
    const token = localStorage.getItem('token')
    if (token) {
      // httpClient 헤더에 토큰 설정
      httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      // Redux 상태 복원
      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: { username: 'admin' } 
      })
    }
  }, [dispatch])

  return (
    <BrowserRouter>
      <React.Suspense fallback={loading}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/404" element={<Page404 />} />
          <Route path="/500" element={<Page500 />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <DefaultLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  )
}

export default App
