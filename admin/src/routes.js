import React from 'react'


const Banners = React.lazy(() => import('./views/banners/Banners'))
const BannerCreate = React.lazy(() => import('./views/banners/BannerCreate'))
const BannerEdit = React.lazy(() => import('./views/banners/BannerEdit'))

const Curators = React.lazy(() => import('./views/curators/Curators'))
const CuratorCreate = React.lazy(() => import('./views/curators/CuratorCreate'))
const CuratorEdit = React.lazy(() => import('./views/curators/CuratorEdit'))

const Users = React.lazy(() => import('./views/users/Users'))
const UserDetail = React.lazy(() => import('./views/users/UserDetail'))
const UserList = React.lazy(() => import('./views/users/UserList'))

const Conversations = React.lazy(() => import('./views/conversations/Conversations'))
const ConversationDetail = React.lazy(() => import('./views/conversations/ConversationDetail'))

const ChatRoomList = React.lazy(() => import('./views/conversations/ChatRoomList'))
const ChatRoomDetail = React.lazy(() => import('./views/conversations/ChatRoomDetail'))

const routes = [
  { path: '/', exact: true, name: '홈' },
  { path: '/banners', name: '배너 관리', element: Banners },
  { path: '/banners/create', name: '배너 생성', element: BannerCreate },
  { path: '/banners/:id/edit', name: '배너 수정', element: BannerEdit },
  { path: '/curators', name: '큐레이터 관리', element: Curators },
  { path: '/curators/create', name: '큐레이터 생성', element: CuratorCreate },
  { path: '/curators/:id/edit', name: '큐레이터 수정', element: CuratorEdit },
  { path: '/users', name: '사용자 관리', element: UserList },
  { path: '/users/:id', name: '사용자 상세', element: UserDetail },
  // { path: '/conversations', name: '대화 내역', element: ConversationList },
  // { path: '/conversations/:id', name: '대화 상세', element: ConversationDetail },
  
  { path: '/conversations', name: '채팅방 관리', element: ChatRoomList },  // 변경된 부분
  { path: '/conversations/:id', name: '채팅방 상세', element: ChatRoomDetail },  // 변경된 부분
]

export default routes
