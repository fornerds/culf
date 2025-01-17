import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CForm,
  CButton,
  CSpinner,
  CAlert,
  CListGroup,
  CListGroupItem,
} from '@coreui/react';
import { format } from 'date-fns';
import httpClient from '../../api/httpClient';

const PaymentRefund = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    fetchPaymentDetail();
  }, [id]);

  const fetchPaymentDetail = async () => {
    try {
      setLoading(true);
      const { data } = await httpClient.get(`/admin/payments/${id}`);
      
      if (data.status !== 'SUCCESS' || !data.refund || data.refund.status !== 'PENDING') {
        setError('환불 처리할 수 없는 결제입니다.');
        setErrorDetails('현재 상태에서는 환불 처리가 불가능합니다.');
      }
      
      setPayment(data);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      setError('결제 정보를 불러오는데 실패했습니다.');
      setErrorDetails('서버에서 결제 정보를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorDetail) => {
    // 문자열 정확히 일치하는 에러 메시지 처리
    if (errorDetail === "Insufficient tokens for refund") {
      return '사용자가 보유한 스톤이 환불하려는 스톤보다 적어 환불이 불가능합니다.';
    }
    if (errorDetail === "Payment not found") {
      return '결제 정보를 찾을 수 없습니다.';
    }
    if (errorDetail === "Refund not found or already processed") {
      return '환불 요청을 찾을 수 없거나 이미 처리되었습니다.';
    }
    if (errorDetail === "Invalid payment method for refund") {
      return '해당 결제 수단으로는 환불이 불가능합니다.';
    }
    
    return '환불 처리 중 오류가 발생했습니다.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorDetails('');

    try {
      setSubmitting(true);
      await httpClient.post(`/admin/refunds/${payment.refund.refund_id}`);
      alert('환불이 성공적으로 처리되었습니다.');
      navigate(`/payments/${id}`);
    } catch (error) {
      console.error('Error processing refund:', error);
      
      // 에러 상세 정보 추출
      let errorDetail = '';
      if (error.response && error.response.data) {
        errorDetail = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : JSON.stringify(error.response.data.detail);
      }

      // 스톤 부족 에러인 경우
      if (errorDetail.includes('Insufficient tokens')) {
        setError('스톤 부족으로 환불 처리가 불가능합니다');
      } 
      // 결제 정보를 찾을 수 없는 경우
      else if (errorDetail.includes('Payment not found')) {
        setError('결제 정보를 찾을 수 없습니다');
      }
      // 이미 처리된 환불인 경우
      else if (errorDetail.includes('already processed')) {
        setError('이미 처리된 환불 요청입니다');
      }
      // 기타 에러의 경우
      else {
        setError('환불 처리 중 오류가 발생했습니다');
      }
    } finally {
      setSubmitting(false);
    }
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
          <CCardHeader>
            <strong>환불 승인</strong>
          </CCardHeader>
          <CCardBody>
            {error && (
              <CAlert color="danger" className="mb-4">
                <h6 className="alert-heading mb-1">환불 처리 불가</h6>
                <p className="mb-1">{error}</p>
                {errorDetails && <small className="d-block mt-2">{errorDetails}</small>}
              </CAlert>
            )}

            <div className="mb-4">
              <h5>결제 정보</h5>
              <CListGroup>
                <CListGroupItem>
                  <div className="fw-bold">결제 번호</div>
                  {payment?.payment_number}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제자</div>
                  {payment?.user_nickname}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제 금액</div>
                  {payment?.amount.toLocaleString()}원
                </CListGroupItem>
                {payment?.tokens_purchased && (
                  <CListGroupItem>
                    <div className="fw-bold">구매한 스톤</div>
                    {payment.tokens_purchased.toLocaleString()}개
                  </CListGroupItem>
                )}
                <CListGroupItem>
                  <div className="fw-bold">결제 수단</div>
                  {payment?.payment_method}
                </CListGroupItem>
                <CListGroupItem>
                  <div className="fw-bold">결제 일시</div>
                  {payment?.payment_date && format(new Date(payment.payment_date), 'yyyy-MM-dd HH:mm:ss')}
                </CListGroupItem>
              </CListGroup>
            </div>

            {payment?.refund && (
              <div className="mb-4">
                <h5>환불 요청 정보</h5>
                <CListGroup>
                  <CListGroupItem>
                    <div className="fw-bold">환불 사유</div>
                    {payment.refund.reason}
                  </CListGroupItem>
                  <CListGroupItem>
                    <div className="fw-bold">요청 일시</div>
                    {format(new Date(payment.refund.created_at), 'yyyy-MM-dd HH:mm:ss')}
                  </CListGroupItem>
                </CListGroup>
              </div>
            )}

            <div className="d-flex justify-content-center gap-3">
              <CButton
                type="submit"
                color="danger"
                disabled={submitting || error}
                className="px-5"
                onClick={handleSubmit}
              >
                {submitting ? <CSpinner size="sm" /> : '환불 승인'}
              </CButton>
              <CButton
                type="button"
                color="secondary"
                onClick={() => navigate(`/payments/${id}`)}
                disabled={submitting}
                className="px-5"
              >
                취소
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
};

export default PaymentRefund;