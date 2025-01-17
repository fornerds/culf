import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CSpinner,
  CBadge,
  CFormInput,
  CInputGroup,
  CInputGroupText,
} from '@coreui/react';
import { cilSearch } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { format } from 'date-fns';
import httpClient from '../../api/httpClient';

const ReadStatusModal = ({ visible, onClose, notification }) => {
  const [loading, setLoading] = useState(true);
  const [statusDetails, setStatusDetails] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible && notification) {
      fetchReadStatus();
    }
  }, [visible, notification]);

  const fetchReadStatus = async () => {
    try {
      setLoading(true);
      const response = await httpClient.get(
        `/admin/notifications/${notification.notification_id}/read-status`
      );
      setStatusDetails(response.data.status_details);
      setError(null);
    } catch (error) {
      console.error('Error fetching read status:', error);
      setError('읽음 상태를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDetails = statusDetails.filter(detail => 
    detail.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    detail.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getReadStatusBadge = (isRead, readAt) => {
    if (!isRead) {
      return <CBadge color="danger">읽지 않음</CBadge>;
    }
    return (
      <div>
        <CBadge color="success">읽음</CBadge>
        <div className="small text-muted mt-1">
          {format(new Date(readAt), 'yyyy.MM.dd HH:mm')}
        </div>
      </div>
    );
  };

  const getStats = () => {
    const total = statusDetails.length;
    const readCount = statusDetails.filter(d => d.is_read).length;
    const percentage = total > 0 ? Math.round((readCount / total) * 100) : 0;
    
    return {
      total,
      readCount,
      unreadCount: total - readCount,
      percentage
    };
  };

  return (
    <CModal visible={visible} onClose={onClose} size="lg">
      <CModalHeader>
        <CModalTitle>읽음 상태 상세</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {!loading && statusDetails.length > 0 && (
          <>
            {/* 통계 정보 */}
            <div className="row mb-4">
              <div className="col">
                <div className="border rounded p-3">
                  <div className="d-flex justify-content-between">
                    <div>
                      <div className="text-medium-emphasis">총 수신자</div>
                      <div className="fs-4 fw-semibold">{getStats().total}명</div>
                    </div>
                    <div>
                      <div className="text-medium-emphasis">읽음</div>
                      <div className="fs-4 fw-semibold text-success">
                        {getStats().readCount}명 ({getStats().percentage}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-medium-emphasis">읽지 않음</div>
                      <div className="fs-4 fw-semibold text-danger">
                        {getStats().unreadCount}명
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 검색 */}
            <CInputGroup className="mb-3">
              <CInputGroupText>
                <CIcon icon={cilSearch} size="sm"/>
              </CInputGroupText>
              <CFormInput
                placeholder="이메일 또는 닉네임으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </CInputGroup>
          </>
        )}

        {/* 상세 목록 */}
        <CTable small hover>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell style={{width: "40%"}}>이메일</CTableHeaderCell>
              <CTableHeaderCell style={{width: "30%"}}>닉네임</CTableHeaderCell>
              <CTableHeaderCell style={{width: "30%"}}>상태</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-4">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : filteredDetails.length > 0 ? (
              filteredDetails.map((detail) => (
                <CTableRow key={detail.user_id}>
                  <CTableDataCell>{detail.email}</CTableDataCell>
                  <CTableDataCell>{detail.nickname}</CTableDataCell>
                  <CTableDataCell>
                    {getReadStatusBadge(detail.is_read, detail.read_at)}
                  </CTableDataCell>
                </CTableRow>
              ))
            ) : (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-4">
                  {searchTerm ? '검색 결과가 없습니다.' : '수신자가 없습니다.'}
                </CTableDataCell>
              </CTableRow>
            )}
          </CTableBody>
        </CTable>
      </CModalBody>
    </CModal>
  );
};

export default ReadStatusModal;