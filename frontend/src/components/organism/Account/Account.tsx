import { Button, LoadingAnimation } from '@/components/atom';
import { useState, useEffect } from 'react';
import styles from './Account.module.css';
import { InputBox, Popup } from '@/components/molecule';
import { PhoneVerificationForm } from '@/components/molecule/PhoneVerificationForm';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/state/server/authQueries';
import { useUser } from '@/hooks/user/useUser';
import logoimage from '@/assets/images/culf.png';

export function Account() {
  const navigate = useNavigate();
  const { logout, isLoading: isLogoutLoading } = useAuth();
  const {
    getUserInfo: { data: userInfo, isLoading: isUserLoading },
    updateUserInfo,
    verifyPassword,
    changePassword,
    isLoading: isUpdateLoading,
  } = useUser();

  // 팝업 상태 관리
  const [isPasswordErrorPopupOpen, setIsPasswordErrorPopupOpen] =
    useState(false);
  const [isLogoutPopupOpen, setIsLogoutPopupOpen] = useState(false);
  const [isUpdateSuccessPopupOpen, setIsUpdateSuccessPopupOpen] =
    useState(false);

  const [form, setForm] = useState({
    email: '',
    nickname: '',
    phoneNumber: '',
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  });

  const [emailMessage, setEmailMessage] = useState('');
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (userInfo) {
      setForm((prev) => ({
        ...prev,
        nickname: userInfo.nickname || '',
        phoneNumber: userInfo.phone_number || '',
        email: userInfo.email || '',
      }));
    }
  }, [userInfo]);

  const handleFormChange = (id: string, value: string) => {
    setForm({
      ...form,
      [id]: value,
    });

    // 비밀번호 관련 메시지 초기화
    if (
      id === 'currentPassword' ||
      id === 'newPassword' ||
      id === 'newPasswordConfirm'
    ) {
      setPasswordMessage('');
    }
  };

  const handlePasswordVerification = async () => {
    if (!form.currentPassword) {
      setPasswordMessage('현재 비밀번호를 입력해주세요.');
      return;
    }

    setIsVerifyingPassword(true);
    try {
      await verifyPassword(form.currentPassword);
      setIsPasswordValid(true);
      setPasswordMessage('비밀번호가 확인되었습니다.');
    } catch (error) {
      setIsPasswordErrorPopupOpen(true);
      setIsPasswordValid(false);
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const validateNewPassword = () => {
    if (!form.newPassword) {
      setPasswordMessage('새 비밀번호를 입력해주세요.');
      return false;
    }
    if (!form.newPasswordConfirm) {
      setPasswordMessage('새 비밀번호 확인을 입력해주세요.');
      return false;
    }
    if (form.newPassword !== form.newPasswordConfirm) {
      setPasswordMessage('새 비밀번호가 일치하지 않습니다.');
      return false;
    }
    if (form.newPassword.length < 8) {
      setPasswordMessage('비밀번호는 8자 이상이어야 합니다.');
      return false;
    }
    return true;
  };

  const handlePasswordChange = async () => {
    if (!isPasswordValid) {
      setPasswordMessage('먼저 현재 비밀번호를 확인해주세요.');
      return;
    }

    if (!validateNewPassword()) {
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setIsUpdateSuccessPopupOpen(true);
      // 비밀번호 변경 후 폼 초기화
      setForm((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        newPasswordConfirm: '',
      }));
      setIsPasswordValid(false);
      setPasswordMessage('');
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail?.message ||
        '비밀번호 변경에 실패했습니다.';
      setPasswordMessage(errorMessage);
      setIsPasswordValid(false);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      const updateData = {
        nickname: form.nickname,
        phone_number: isPhoneVerified ? form.phoneNumber : undefined,
      };

      await updateUserInfo(updateData);
      setIsUpdateSuccessPopupOpen(true);
    } catch (error) {
      console.error('Failed to update user info:', error);
      setPasswordMessage('변경사항 저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsLogoutPopupOpen(true);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handlePasswordReset = () => {
    navigate('/change-password');
  };

  const handleLogoutConfirm = () => {
    setIsLogoutPopupOpen(false);
    navigate('/login');
  };

  if (isUserLoading) {
    return (
      <div
        style={{
          marginTop: '250px',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <LoadingAnimation
          imageUrl={logoimage}
          alt="Description"
          width={58}
          height={19}
          duration={2200}
        />
        <p className="font-tag-1" style={{ color: '#a1a1a1' }}>
          회원정보 조회 중
        </p>
      </div>
    );
  }

  return (
    <>
      <main className={styles.accountContentWrap}>
        <div className={styles.accountContent}>
          <InputBox
            id="email"
            label="이메일"
            type="email"
            placeholder="변경할 이메일 입력"
            value={form.email}
            validationMessage={emailMessage}
            validationMessageType="error"
            onChangeObj={handleFormChange}
            disabled={true}
          />
          <InputBox
            id="nickname"
            label="닉네임"
            placeholder="변경할 닉네임 입력"
            value={form.nickname}
            onChangeObj={handleFormChange}
            validationMessage={nicknameMessage}
          />
          <PhoneVerificationForm
            phoneNumber={form.phoneNumber}
            findPw={false}
            isVerified={isPhoneVerified}
            onVerificationSuccess={() => setIsPhoneVerified(true)}
            onChangeObj={handleFormChange}
            isAccountPage={true}
          />
          <section className={styles.passwordSection}>
            <InputBox
              id="currentPassword"
              label="비밀번호 변경"
              type="password"
              placeholder="기존 비밀번호 입력"
              value={form.currentPassword}
              buttonSize="size4"
              buttonVariant="default"
              buttonText={isVerifyingPassword ? '확인 중...' : '확인'}
              buttonDisabled={isVerifyingPassword}
              onChangeObj={handleFormChange}
              onClick={handlePasswordVerification}
              validationMessage={
                isPasswordValid ? '비밀번호가 확인되었습니다.' : passwordMessage
              }
              validationMessageType={isPasswordValid ? 'success' : 'error'}
            />
            {isPasswordValid && (
              <>
                <InputBox
                  id="newPassword"
                  label="신규 비밀번호"
                  type="password"
                  placeholder="새 비밀번호 입력 (8자 이상)"
                  value={form.newPassword}
                  onChangeObj={handleFormChange}
                />
                <InputBox
                  id="newPasswordConfirm"
                  label="신규 비밀번호 확인"
                  type="password"
                  placeholder="새 비밀번호를 다시 입력해주세요"
                  value={form.newPasswordConfirm}
                  onChangeObj={handleFormChange}
                  validationMessage={!isPasswordValid ? '' : passwordMessage}
                  validationMessageType="error"
                />
                <div className={styles.changePasswordButtonWrapper}>
                  <Button
                    size="size3"
                    onClick={handlePasswordChange}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? '변경 중...' : '비밀번호 변경'}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
        <div className={styles.accountBottom}>
          <Button onClick={handleSaveChanges} disabled={isUpdateLoading}>
            {isUpdateLoading ? '저장 중...' : '변경사항 저장'}
          </Button>
          <div className={styles.buttonGroup}>
            <Button
              size="size3"
              variant="warning"
              onClick={() => navigate('/delete-account')}
            >
              계정탈퇴하기
            </Button>
            <Button
              size="size3"
              variant="less-highlight"
              onClick={handleLogout}
              disabled={isLogoutLoading}
            >
              {isLogoutLoading ? '로그아웃 중...' : '로그아웃'}
            </Button>
          </div>
        </div>
      </main>

      <Popup
        type="confirm"
        isOpen={isPasswordErrorPopupOpen}
        onClose={() => setIsPasswordErrorPopupOpen(false)}
        content="비밀번호가 틀렸습니다. 비밀번호를 찾으시겠습니까?"
        onConfirm={handlePasswordReset}
        confirmText="비밀번호 찾기"
        cancelText="다시 입력"
      />

      <Popup
        type="alert"
        isOpen={isLogoutPopupOpen}
        onClose={handleLogoutConfirm}
        content="로그아웃 되었습니다."
      />

      <Popup
        type="alert"
        isOpen={isUpdateSuccessPopupOpen}
        onClose={() => {
          navigate('/mypage/account');
          setIsUpdateSuccessPopupOpen(false);
        }}
        content="정상적으로 수정되었습니다."
      />
    </>
  );
}
