import React from 'react'
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

import avatar8 from './../../assets/images/avatars/1.jpg'

const AppHeaderDropdown = () => {
  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle placement="bottom-end" className="py-0" caret={false}>
        <CAvatar src={avatar8} size="md" />
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        <CDropdownItem href="#">
          <CIcon icon={cilUser} className="me-2" />
          프로필
        </CDropdownItem>
        <CDropdownItem href="#">
          <CIcon icon={cilSettings} className="me-2" />
          설정
        </CDropdownItem>
        <CDropdownItem href="#">
          <CIcon icon={cilLockLocked} className="me-2" />
          로그아웃
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown
