import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  CAvatar,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilLockLocked,
  cilSettings,
  cilUser,
} from '@coreui/icons'
import httpClient from 'src/api/httpClient'
import avatar8 from './../../assets/images/avatars/1.jpg'

const AppHeaderDropdown = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      // 백엔드 로그아웃 API 호출
      await httpClient.post('/logout')
      
      // 로컬 스토리지에서 토큰 제거
      localStorage.removeItem('token')
      
      // HTTP 클라이언트의 헤더에서 Authorization 제거
      delete httpClient.defaults.headers.common['Authorization']
      
      // Redux 상태 업데이트
      dispatch({ type: 'LOGOUT' })
      
      // 로그인 페이지로 리다이렉트
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      // 에러가 발생하더라도 로컬의 로그아웃 처리는 진행
      localStorage.removeItem('token')
      delete httpClient.defaults.headers.common['Authorization']
      dispatch({ type: 'LOGOUT' })
      navigate('/login')
    }
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle placement="bottom-end" className="py-0" caret={false}>
        <CAvatar src={avatar8} size="md" />
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        {/* <CDropdownItem href="#">
          <CIcon icon={cilUser} className="me-2" />
          프로필
        </CDropdownItem>
        <CDropdownItem href="#">
          <CIcon icon={cilSettings} className="me-2" />
          설정
        </CDropdownItem> */}
        <CDropdownItem onClick={handleLogout}>
          <CIcon icon={cilLockLocked} className="me-2" />
          로그아웃
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown