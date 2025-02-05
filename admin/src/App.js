import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import './scss/style.scss'
import httpClient from './api/httpClient'

// 로딩 스피너 컴포넌트
const loading = (
 <div className="pt-3 text-center">
   <div className="sk-spinner sk-spinner-pulse"></div>
 </div>
)

// 레이아웃 컴포넌트 
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// 페이지 컴포넌트들
const Login = React.lazy(() => import('./views/pages/login/Login'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page403 = React.lazy(() => import('./views/pages/page403/Page403'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))

// 라우트 가드 컴포넌트
const AdminRoute = React.lazy(() => import('./components/routes/AdminRoute'))

const App = () => {
 const dispatch = useDispatch()

 useEffect(() => {
   const initializeAuth = async () => {
     const token = localStorage.getItem('token')
     if (token) {
       try {
         // HTTP 클라이언트에 토큰 설정
         httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
         
         // 사용자 정보 가져오기
         const userResponse = await httpClient.get('/users/me')
         const userData = userResponse.data
         
         // Redux 상태 업데이트
         dispatch({ 
           type: 'LOGIN_SUCCESS', 
           payload: { 
             username: userData.email,
             role: userData.role 
           }
         })
       } catch (error) {
         console.error('인증 초기화 오류:', error)
         localStorage.removeItem('token')
         delete httpClient.defaults.headers.common['Authorization']
       }
     }
   }
   
   initializeAuth()
 }, [dispatch])

 return (
   <BrowserRouter basename="/admin">
     <React.Suspense fallback={loading}>
       <Routes>
         <Route path="/login" element={<Login />} />
         <Route path="/404" element={<Page404 />} />
         <Route path="/403" element={<Page403 />} />
         <Route path="/500" element={<Page500 />} />
         <Route
           path="/"
           element={
             <AdminRoute>
               <Navigate to="/banners" replace />
             </AdminRoute>
           }
         />
         <Route
           path="*"
           element={
             <AdminRoute>
               <DefaultLayout />
             </AdminRoute>
           }
         />
       </Routes>
     </React.Suspense>
   </BrowserRouter>
 )
}

export default App