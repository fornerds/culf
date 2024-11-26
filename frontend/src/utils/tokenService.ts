export const tokenService = {
  getAccessToken: () => sessionStorage.getItem('accessToken'),
  setAccessToken: (token: string) =>
    sessionStorage.setItem('accessToken', token),
  removeAccessToken: () => sessionStorage.removeItem('accessToken'),
};
