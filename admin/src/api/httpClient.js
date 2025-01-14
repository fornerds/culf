import axios from 'axios'

//const API_URL = import.meta.env.VITE_API_URL || 'http://culf.ai'
const API_URL = 'http://localhost:8000'

console.log('API_URL:', API_URL)

const httpClient = axios.create({
    baseURL: `${API_URL}/v1`,
    headers: {
      'Content-Type': 'application/json',
    },
})

httpClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 토큰이 있는 상태에서의 인증 실패만 리다이렉트 처리
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token')
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)

export default httpClient
