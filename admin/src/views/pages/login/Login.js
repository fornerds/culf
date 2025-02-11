import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import httpClient from '../../../api/httpClient'

const Login = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
  
    const email = e.target.username.value
    const password = e.target.password.value
  
    try {
      const response = await httpClient.post('/auth/login', {
        email,
        password
      })
      
      const { access_token } = response.data
      
      // 사용자 정보 가져오기
      httpClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      const userResponse = await httpClient.get('/users/me')
      const userData = userResponse.data
      
      // 관리자 또는 슈퍼유저가 아닌 경우 로그인 차단
      if (!['ADMIN'].includes(userData.role)) {
        setError('관리자 계정으로만 로그인이 가능합니다.')
        setIsLoading(false)
        // 헤더에서 토큰 제거
        delete httpClient.defaults.headers.common['Authorization']
        return
      }
      
      localStorage.setItem('token', access_token)
      
      dispatch({ 
        type: 'LOGIN_SUCCESS', 
        payload: { 
          username: email,
          role: userData.role 
        }
      })
      
      navigate('/')
    } catch (error) {
      console.error('Login error:', error)
      
      let errorMessage = '로그인 중 오류가 발생했습니다.'
      
      if (error.response) {
        switch (error.response.status) {
          case 401:
            errorMessage = '아이디 또는 비밀번호가 올바르지 않습니다.'
            break
          case 403:
            errorMessage = '접근이 거부되었습니다.'
            break
          case 404:
            errorMessage = '존재하지 않는 계정입니다.'
            break
          case 500:
            errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            break
          default:
            errorMessage = error.response.data?.detail?.message || '로그인에 실패했습니다.'
        }
      }
      
      setError(errorMessage)
      dispatch({ 
        type: 'LOGIN_FAILURE', 
        payload: errorMessage
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-light min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm onSubmit={handleSubmit}>
                    <h1>관리자 로그인</h1>
                    <p className="text-medium-emphasis">관리자 계정으로 로그인하세요</p>
                    {error && (
                      <CAlert color="danger" className="mb-3">
                        {error}
                      </CAlert>
                    )}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        name="username"
                        placeholder="아이디"
                        autoComplete="username"
                        disabled={isLoading}
                        required
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        name="password"
                        type="password"
                        placeholder="비밀번호"
                        autoComplete="current-password"
                        disabled={isLoading}
                        required
                      />
                    </CInputGroup>
                    <CRow>
                      <CCol xs={6}>
                        <CButton 
                          type="submit" 
                          color="primary" 
                          className="px-4"
                          disabled={isLoading}
                        >
                          {isLoading ? '로그인 중...' : '로그인'}
                        </CButton>
                      </CCol>
                    </CRow>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login