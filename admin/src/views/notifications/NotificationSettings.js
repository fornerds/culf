import React, { useState, useEffect } from 'react'
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
  CSpinner,
  CFormSwitch,
  CFormSelect,
  CAlert
} from '@coreui/react'
import httpClient from '../../api/httpClient'

const NotificationSettings = () => {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await httpClient.get('/v1/admin/notification-settings')
      setSettings(data)
    } catch (error) {
      console.error('Error fetching notification settings:', error)
      setError('알림 설정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSettingChange = async (settingId, field, value) => {
    try {
      await httpClient.put(`/v1/admin/notification-settings/${settingId}`, {
        [field]: value
      })
      await fetchSettings() // 설정 변경 후 다시 불러오기
    } catch (error) {
      console.error('Error updating notification setting:', error)
      setError('설정 변경에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="text-center">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <CRow>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <strong>알림 설정 관리</strong>
          </CCardHeader>
          <CCardBody>
            {error && (
              <CAlert color="danger" className="mb-3">
                {error}
              </CAlert>
            )}
            
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>알림 유형</CTableHeaderCell>
                  <CTableHeaderCell>기본 활성화</CTableHeaderCell>
                  <CTableHeaderCell>발송 채널</CTableHeaderCell>
                  <CTableHeaderCell>재발송 주기</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {settings.map((setting) => (
                  <CTableRow key={setting.setting_id}>
                    <CTableDataCell>{setting.notification_type}</CTableDataCell>
                    <CTableDataCell>
                      <CFormSwitch
                        id={`switch-${setting.setting_id}`}
                        checked={setting.is_enabled}
                        onChange={(e) => handleSettingChange(
                          setting.setting_id,
                          'is_enabled',
                          e.target.checked
                        )}
                      />
                    </CTableDataCell>
                    <CTableDataCell>
                      <CFormSelect
                        value={setting.channel}
                        onChange={(e) => handleSettingChange(
                          setting.setting_id,
                          'channel',
                          e.target.value
                        )}
                        options={[
                          { label: '이메일', value: 'email' },
                          { label: '푸시', value: 'push' },
                          { label: 'SMS', value: 'sms' },
                          { label: '전체', value: 'all' }
                        ]}
                      />
                    </CTableDataCell>
                    <CTableDataCell>
                      <CFormSelect
                        value={setting.resend_interval}
                        onChange={(e) => handleSettingChange(
                          setting.setting_id,
                          'resend_interval',
                          e.target.value
                        )}
                        options={[
                          { label: '재발송 안함', value: 'never' },
                          { label: '1시간', value: '1h' },
                          { label: '24시간', value: '24h' },
                          { label: '7일', value: '7d' }
                        ]}
                      />
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default NotificationSettings