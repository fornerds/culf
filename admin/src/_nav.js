import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilBriefcase,
  cilPeople,
  cilImage,
  cilCommentSquare,
  cilNewspaper,
  cilBell,
  cilEnvelopeClosed,
  cilDollar,
  cilSettings,
  cilCloudDownload,
  cilBuilding,
  cilLibrary
} from '@coreui/icons'
import { CNavItem, CNavGroup } from '@coreui/react'

const _nav = [
  {
    component: CNavItem,
    name: '배너 관리',
    to: '/banners',
    icon: <CIcon icon={cilImage} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '캐릭터 관리',
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
  {
    component: CNavItem,
    name: '알림 관리',
    to: '/notifications',
    icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '공지사항 관리',
    to: '/notices',
    icon: <CIcon icon={cilNewspaper} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '문의사항 관리',
    to: '/inquiries',
    icon: <CIcon icon={cilEnvelopeClosed} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '결제 관리',
    to: '/payments',
    icon: <CIcon icon={cilDollar} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '기관 관리',
    to: '/institutions',
    icon: <CIcon icon={cilBuilding} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '전시 관리',
    to: '/exhibitions',
    icon: <CIcon icon={cilLibrary} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '데이터 관리',
    to: '/data-management',
    icon: <CIcon icon={cilCloudDownload} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: '시스템 설정',
    to: '/settings',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  }
]

export default _nav