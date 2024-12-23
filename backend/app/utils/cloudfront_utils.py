import boto3
import time
from app.core.config import settings

cloudfront_client = boto3.client('cloudfront',
                                 aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                                 aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                                 region_name=settings.AWS_REGION)

def get_cloudfront_url(object_name: str) -> str:
    """CloudFront URL 생성"""
    return f"https://{settings.CLOUDFRONT_DOMAIN}/{object_name}"

def invalidate_cloudfront_cache(object_path):
    try:
        response = cloudfront_client.create_invalidation(
            DistributionId=settings.CLOUDFRONT_DISTRIBUTION_ID,
            InvalidationBatch={
                'Paths': {
                    'Quantity': 1,
                    'Items': [f'/{object_path}']
                },
                'CallerReference': str(time.time()).replace(".", "")
            }
        )
        return response['Invalidation']['Id']
    except Exception as e:
        print(f"Error invalidating CloudFront cache: {e}")
        return None