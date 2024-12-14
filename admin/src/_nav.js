import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilBriefcase,
  cilPeople,
  cilImage,
  cilCommentSquare,
} from '@coreui/icons'
import { CNavItem } from '@coreui/react'

const _nav = [
  {
    component: CNavItem,
    name: '배너 관리',
    to: '/banners',
    icon: <CIcon icon={cilImage} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '큐레이터 관리',
    to: '/curators',
    icon: <CIcon icon={cilBriefcase} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '사용자 관리',
    to: '/users',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '대화 내역',
    to: '/conversations',
    icon: <CIcon icon={cilCommentSquare} customClassName="nav-icon" />,
  },
]

export default _nav
