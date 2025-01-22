import React from 'react'


const Banners = React.lazy(() => import('./views/banners/Banners'))
const BannerCreate = React.lazy(() => import('./views/banners/BannerCreate'))
const BannerEdit = React.lazy(() => import('./views/banners/BannerEdit'))

const Curators = React.lazy(() => import('./views/curators/Curators'))
const CuratorCreate = React.lazy(() => import('./views/curators/CuratorCreate'))
const CuratorEdit = React.lazy(() => import('./views/curators/CuratorEdit'))

const UserDetail = React.lazy(() => import('./views/users/UserDetail'))
const UserCreate = React.lazy(() => import('./views/users/UserCreate'))
const UserList = React.lazy(() => import('./views/users/UserList'))

const Conversations = React.lazy(() => import('./views/conversations/Conversations'))
const ConversationDetail = React.lazy(() => import('./views/conversations/ConversationDetail'))

const ChatRoomList = React.lazy(() => import('./views/conversations/ChatRoomList'))
const ChatRoomDetail = React.lazy(() => import('./views/conversations/ChatRoomDetail'))

const NoticeList = React.lazy(() => import('./views/notices/NoticeList'))
const NoticeCreate = React.lazy(() => import('./views/notices/NoticeCreate'))
const NoticeEdit = React.lazy(() => import('./views/notices/NoticeEdit'))

const NotificationList = React.lazy(() => import('./views/notifications/NotificationList'))
const NotificationSettings = React.lazy(() => import('./views/notifications/NotificationSettings'))

const InquiryList = React.lazy(() => import('./views/inquiries/InquiryList'))
const InquiryDetail = React.lazy(() => import('./views/inquiries/InquiryDetail'))

const PaymentList = React.lazy(() => import('./views/payments/PaymentList'))
const PaymentDetail = React.lazy(() => import('./views/payments/PaymentDetail'))
const PaymentCreate = React.lazy(() => import('./views/payments/PaymentCreate'))
const PaymentRefund = React.lazy(() => import('./views/payments/PaymentRefund'))

const SystemSettings = React.lazy(() => import('./views/settings/SystemSettings'))

const routes = [
  { path: '/', exact: true, name: '홈' },
  { path: '/banners', name: '배너 관리', element: Banners },
  { path: '/banners/create', name: '배너 생성', element: BannerCreate },
  { path: '/banners/:id/edit', name: '배너 수정', element: BannerEdit },
  { path: '/curators', name: '캐릭터 관리', element: Curators },
  { path: '/curators/create', name: '캐릭터 생성', element: CuratorCreate },
  { path: '/curators/:id/edit', name: '캐릭터 수정', element: CuratorEdit },
  { path: '/users', name: '사용자 관리', element: UserList },
  { path: '/users/create', name: '사용자자 생성', element: UserCreate },
  { path: '/users/:id', name: '사용자 상세', element: UserDetail },
  { path: '/conversations', name: '채팅방 관리', element: ChatRoomList },
  { path: '/conversations/:id', name: '채팅방 상세', element: ChatRoomDetail },
  { path: '/notices', name: '공지사항 관리', element: NoticeList },
  { path: '/notices/create', name: '공지사항 생성', element: NoticeCreate },
  { path: '/notices/:id/edit', name: '공지사항 수정', element: NoticeEdit },
  { path: '/notifications', name: '알림 관리', element: NotificationList },
  { path: '/notifications/settings', name: '알림 설정', element: NotificationSettings },
  { path: '/inquiries', name: '문의사항 관리', element: InquiryList },
  { path: '/inquiries/:id', name: '문의사항 상세', element: InquiryDetail },
  { path: '/payments', name: '결제 관리', element: PaymentList },
  { path: '/payments/create', name: '수동 결제 생성', element: PaymentCreate },
  { path: '/payments/:id', name: '결제 상세', element: PaymentDetail },
  { path: '/payments/:id/refund', name: '결제 환불', element: PaymentRefund },
  { path: '/settings', name: '시스템 설정', element: SystemSettings }
]

export default routes
