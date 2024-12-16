import { useQuery } from '@tanstack/react-query';
import { banner } from '@/api';

export const useGetBanners = () => {
  return useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const { data } = await banner.getBanners();
      const currentDate = new Date().toISOString().split('T')[0];
      
      // 현재 유효한 배너만 필터링
      return data.filter((banner: any) => 
        banner.start_date <= currentDate && 
        banner.end_date >= currentDate
      );
    },
    // 5분마다 자동 리프레시
    refetchInterval: 5 * 60 * 1000,
    // 백그라운드에서도 리프레시 허용
    refetchIntervalInBackground: true,
  });
};