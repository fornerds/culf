import React, { useState, useEffect } from 'react';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CPagination,
  CPaginationItem,
  CFormSelect,
  CFormInput,
  CButton,
  CBadge,
  CSpinner,
  CInputGroup,
  CNav,
  CNavItem,
  CNavLink,
} from '@coreui/react';
import { cilCloudDownload, cilSearch } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import httpClient from '../../api/httpClient';

const UserList = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [status, setStatus] = useState('all');
  const [tokenFilter, setTokenFilter] = useState('all');
  const limit = 10;

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchQuery, sortField, sortOrder, status, tokenFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await httpClient.get('/admin/users', {
        params: {
          page: currentPage,
          limit,
          search: searchQuery,
          sort: `${sortField}:${sortOrder}`,
          status,
          token_filter: tokenFilter
        }
      });
      setUsers(data.users);
      setTotalCount(data.total_count);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(tempSearchQuery);
    setCurrentPage(1);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSort = (field) => {
    setSortOrder(sortField === field && sortOrder === 'asc' ? 'desc' : 'asc');
    setSortField(field);
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const { data } = await httpClient.get('/admin/users/export');
  
      const exportData = data.users.map(user => ({
        '닉네임': user.nickname,
        '이메일': user.email,
        '가입일': format(new Date(user.created_at), 'yyyy-MM-dd HH:mm:ss'),
        '마지막 채팅일': user.last_chat_at
          ? format(new Date(user.last_chat_at), 'yyyy-MM-dd HH:mm:ss')
          : '-',
        '상태': user.status,
        '권한': user.role,
        '스톤 잔액': user.total_tokens,
        '월간 스톤 사용량': user.monthly_token_usage,
        '마케팅 동의': user.marketing_agreed ? 'Y' : 'N',
        '회원 구분': user.is_corporate ? '기업회원' : '일반회원',
        '가입 경로': user.provider,
        '연락처': user.phone_number || '-',
        '생년월일': user.birthdate ? format(new Date(user.birthdate), 'yyyy-MM-dd') : '-',
        '성별': user.gender === 'M' ? '남성' : user.gender === 'F' ? '여성' : '기타'
      }));
  
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, '사용자목록');
  
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = `사용자목록_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      saveAs(new Blob([wbout]), fileName);
    } catch (error) {
      console.error('Error exporting users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      ACTIVE: { color: 'success', label: '활성' },
      WITHDRAWN: { color: 'dark', label: '비활성' },
      BANNED: { color: 'danger', label: '차단' },
    };
    const statusInfo = statusMap[status] || { color: 'secondary', label: '알 수 없음' };
    return <CBadge color={statusInfo.color}>{statusInfo.label}</CBadge>;
  };

  const getRoleText = (role) => {
    const roleMap = {
      'SUPERUSER': '슈퍼유저',
      'ADMIN': '관리자',
      'USER': '일반사용자'
    };
    return roleMap[role] || '일반사용자';
  };

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    );
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <strong>사용자 관리</strong>
            <div className="d-flex gap-2">
              <CButton
                color="primary"
                size="sm"
                onClick={() => navigate('/users/create')}
              >
                + 사용자 생성
              </CButton>
              <CButton
                color="secondary"
                size="sm"
                onClick={handleExportExcel}
              >
                <CIcon icon={cilCloudDownload} className="me-2" />
                사용자 목록 내보내기
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <div className="mb-3">
              <CNav variant="tabs">
                <CNavItem>
                  <CNavLink active={status === 'all'} onClick={() => setStatus('all')}>
                    전체
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink active={status === 'ACTIVE'} onClick={() => setStatus('ACTIVE')}>
                    활성
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink active={status === 'WITHDRAWN'} onClick={() => setStatus('WITHDRAWN')}>
                    비활성
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink active={status === 'BANNED'} onClick={() => setStatus('BANNED')}>
                    차단
                  </CNavLink>
                </CNavItem>
              </CNav>
            </div>

            <div className="mb-3 d-flex justify-content-between align-items-center">
              <div className="d-flex gap-2">
                <CFormSelect
                  style={{ width: '200px' }}
                  value={tokenFilter}
                  onChange={(e) => setTokenFilter(e.target.value)}
                >
                  <option value="all">전체 스톤 사용량</option>
                  <option value="high">높은 사용량 (1000+)</option>
                  <option value="medium">중간 사용량 (500-1000)</option>
                  <option value="low">낮은 사용량 (0-500)</option>
                </CFormSelect>
              </div>
              <CInputGroup style={{ width: '300px' }}>
                <CFormInput
                  placeholder="닉네임 또는 이메일로 검색"
                  value={tempSearchQuery}
                  onChange={(e) => setTempSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <CButton
                  color="primary"
                  variant="outline"
                  onClick={handleSearch}
                >
                  <CIcon icon={cilSearch} />
                </CButton>
              </CInputGroup>
            </div>

            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell onClick={() => handleSort('nickname')} style={{ cursor: 'pointer' }}>
                    닉네임
                  </CTableHeaderCell>
                  <CTableHeaderCell onClick={() => handleSort('email')} style={{ cursor: 'pointer' }}>
                    이메일
                  </CTableHeaderCell>
                  <CTableHeaderCell onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                    가입일
                  </CTableHeaderCell>
                  <CTableHeaderCell onClick={() => handleSort('last_chat_at')} style={{ cursor: 'pointer' }}>
                    마지막 채팅 시간
                  </CTableHeaderCell>
                  <CTableHeaderCell onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    상태
                  </CTableHeaderCell>
                  <CTableHeaderCell onClick={() => handleSort('total_tokens')} style={{ cursor: 'pointer' }}>
                    스톤 잔액
                  </CTableHeaderCell>
                  <CTableHeaderCell onClick={() => handleSort('monthly_token_usage')} style={{ cursor: 'pointer' }}>
                    월간 스톤 사용량
                  </CTableHeaderCell>
                  <CTableHeaderCell>권한</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {users.map((user) => (
                  <CTableRow
                    key={user.user_id}
                    onClick={() => navigate(`/users/${user.user_id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <CTableDataCell>{user.nickname}</CTableDataCell>
                    <CTableDataCell>{user.email}</CTableDataCell>
                    <CTableDataCell>{format(new Date(user.created_at), 'yyyy-MM-dd HH:mm')}</CTableDataCell>
                    <CTableDataCell>
                      {user.last_chat_at
                        ? format(new Date(user.last_chat_at), 'yyyy-MM-dd HH:mm')
                        : '-'}
                    </CTableDataCell>
                    <CTableDataCell>{getStatusBadge(user.status)}</CTableDataCell>
                    <CTableDataCell>{user.total_tokens.toLocaleString()}</CTableDataCell>
                    <CTableDataCell>{user.monthly_token_usage.toLocaleString()}</CTableDataCell>
                    <CTableDataCell>{getRoleText(user.role)}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
            <CPagination align="center" aria-label="Page navigation">
              <CPaginationItem
                aria-label="Previous"
                disabled={currentPage <= 10}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 10))}
              >
                <span aria-hidden="true">&lt;</span>
              </CPaginationItem>

              {Array.from(
                { length: 10 },
                (_, i) => {
                  const pageNum = Math.floor((currentPage - 1) / 10) * 10 + i + 1;
                  return pageNum <= Math.ceil(totalCount / limit) ? (
                    <CPaginationItem
                      key={i}
                      active={currentPage === pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </CPaginationItem>
                  ) : null;
                }
              )}

              <CPaginationItem
                aria-label="Next"
                disabled={Math.floor((currentPage - 1) / 10) * 10 + 11 > Math.ceil(totalCount / limit)}
                onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / limit), Math.floor((currentPage - 1) / 10) * 10 + 11))}
              >
                <span aria-hidden="true">&gt;</span>
              </CPaginationItem>
            </CPagination>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default UserList;