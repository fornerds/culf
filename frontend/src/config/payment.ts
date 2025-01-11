export const PAYMENT_CONFIG = {
    portone: {
      impCode: import.meta.env.VITE_PORTONE_IMP_CODE,
    },
    pgProviders: {
        KAKAO: import.meta.env.VITE_PORTONE_PG_PROVIDER_KAKAO,
        KAKAO_SUBSCRIPTION: import.meta.env.VITE_PORTONE_PG_PROVIDER_KAKAO_SUBSCRIPTION,
        DANAL_TPAY: import.meta.env.VITE_PORTONE_PG_PROVIDER_DANAL_TPAY,
        DANAL: import.meta.env.VITE_PORTONE_PG_PROVIDER_DANAL
    },
    payMethods: {
        CARD: 'card',
        TRANS: 'trans',
        VBANK: 'vbank',
        PHONE: 'phone'
    }
};