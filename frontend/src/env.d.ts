// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly MODE: string;
  readonly VITE_PORTONE_IMP_CODE: string;
  readonly VITE_PORTONE_PG_PROVIDER_KAKAO: string;
  readonly VITE_PORTONE_PG_PROVIDER_KAKAO_SUBSCRIPTION: string;
  readonly VITE_PORTONE_PG_PROVIDER_DANAL_TPAY: string;
  readonly VITE_PORTONE_PG_PROVIDER_DANAL: string;
  // 다른 환경 변수들을 여기에 추가할 수 있습니다
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
