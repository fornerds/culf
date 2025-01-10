from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc, case, distinct
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from app.domains.user.models import User
from app.domains.token.models import Token, TokenUsageHistory
from app.domains.payment.models import Payment
import logging

logger = logging.getLogger(__name__)


def get_admin_users(
    db: Session,
    page: int = 1,
    limit: int = 10,
    search: str = None,
    sort: str = "created_at:desc",
    status: str = "all",
    token_filter: str = "all"
) -> Dict:
    
    # Base query
    query = db.query(
        User,
        Token.total_tokens,
        func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0).label('monthly_token_usage')
    ).outerjoin(
        Token, User.user_id == Token.user_id
    ).outerjoin(
        TokenUsageHistory,
        (User.user_id == TokenUsageHistory.user_id) &
        (TokenUsageHistory.used_at >= datetime.now() - timedelta(days=30))
    ).group_by(User.user_id, Token.total_tokens)

    # Search filter
    if search:
        query = query.filter(
            or_(
                User.nickname.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )

    # Status filter - WITHDRAWN 상태도 포함하도록 수정
    if status != "all":
        if status == "WITHDRAWN":
            query = query.filter(User.status == "WITHDRAWN")
        else:
            # 다른 상태일 때는 기존대로 필터링
            query = query.filter(User.status == status)

    # Token usage filter
    if token_filter != "all":
        token_ranges = {
            "high": (1000, None),
            "medium": (500, 1000),
            "low": (0, 500)
        }
        if token_filter in token_ranges:
            min_val, max_val = token_ranges[token_filter]
            if max_val:
                query = query.having(
                    func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0).between(min_val, max_val)
                )
            else:
                query = query.having(
                    func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0) >= min_val
                )

    total_count = query.count()

    # Sorting
    sort_field, sort_direction = sort.split(':')
    sort_model = getattr(User, sort_field)
    if sort_direction == 'desc':
        query = query.order_by(desc(sort_model))
    else:
        query = query.order_by(asc(sort_model))

    # Pagination
    query = query.offset((page - 1) * limit).limit(limit)

    results = query.all()
    users = []
    for user, total_tokens, monthly_usage in results:
        users.append({
            "user_id": str(user.user_id),
            "nickname": user.nickname,
            "email": user.email,
            "created_at": user.created_at,
            "status": user.status,
            "role": user.role,
            "total_tokens": total_tokens or 0,
            "monthly_token_usage": int(monthly_usage or 0)
        })

    return {
        "users": users,
        "total_count": total_count,
        "page": page,
        "limit": limit
    }

def get_admin_users_for_export(db: Session) -> List[Dict]:
    """전체 사용자 목록을 엑셀 다운로드용으로 조회합니다."""
    query = db.query(
        User,
        Token.total_tokens,
        func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0).label('monthly_token_usage')
    ).outerjoin(
        Token, User.user_id == Token.user_id
    ).outerjoin(
        TokenUsageHistory,
        (User.user_id == TokenUsageHistory.user_id) &
        (TokenUsageHistory.used_at >= datetime.now() - timedelta(days=30))
    ).group_by(User.user_id, Token.total_tokens)

    results = query.all()
    users = []
    for user, total_tokens, monthly_usage in results:
        users.append({
            "nickname": user.nickname,
            "email": user.email,
            "created_at": user.created_at,
            "status": user.status,
            "role": user.role,
            "total_tokens": total_tokens or 0,
            "monthly_token_usage": int(monthly_usage or 0)
        })

    return users


def update_user_status(db: Session, user_id: str, status: str) -> User:
    """사용자의 상태를 업데이트합니다."""
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError("User not found")

        allowed_statuses = ['ACTIVE', 'INACTIVE', 'BANNED']
        if status not in allowed_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(allowed_statuses)}")

        # WITHDRAWN 상태의 사용자는 상태 변경 불가
        if user.status == 'WITHDRAWN':
            raise ValueError("Cannot change status of withdrawn user")

        user.status = status
        user.updated_at = datetime.now()

        db.commit()
        db.refresh(user)
        return user

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating user status: {str(e)}")
        raise e

def update_user_role(db: Session, user_id: str, role: str) -> User:
    """사용자의 권한을 업데이트합니다."""
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise ValueError("User not found")

        allowed_roles = ['USER', 'ADMIN']
        if role not in allowed_roles:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(allowed_roles)}")

        # WITHDRAWN 상태의 사용자는 권한 변경 불가
        if user.status == 'WITHDRAWN':
            raise ValueError("Cannot change role of withdrawn user")

        user.role = role
        user.updated_at = datetime.now()

        db.commit()
        db.refresh(user)
        return user

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating user role: {str(e)}")
        raise e

def get_admin_user_detail(db: Session, user_id: str) -> Optional[Dict]:
    """관리자용 사용자 상세 정보를 조회합니다."""
    try:
        # 기본 사용자 정보 조회
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return None

        # 토큰 정보 조회
        token = db.query(Token).filter(Token.user_id == user_id).first()

        # 최근 30일 토큰 사용량
        monthly_token_usage = db.query(
            func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0)
        ).filter(
            TokenUsageHistory.user_id == user_id,
            TokenUsageHistory.used_at >= datetime.now() - timedelta(days=30)
        ).scalar()

        # 총 결제 금액
        total_payment = db.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.user_id == user_id,
            Payment.status == 'SUCCESS'
        ).scalar()

        # 최근 30일 결제 금액
        monthly_payment = db.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(
            Payment.user_id == user_id,
            Payment.status == 'SUCCESS',
            Payment.payment_date >= datetime.now() - timedelta(days=30)
        ).scalar()

        # 상세 정보 구성
        user_detail = {
            "user_id": str(user.user_id),
            "email": user.email,
            "nickname": user.nickname,
            "phone_number": user.phone_number,
            "birthdate": user.birthdate,
            "gender": user.gender,
            "status": user.status,
            "role": user.role,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "deleted_at": user.deleted_at,
            "last_login_at": user.last_login_at,
            "is_corporate": user.is_corporate,
            "marketing_agreed": user.marketing_agreed,
            "provider": user.provider,
            "token_info": {
                "total_tokens": token.total_tokens if token else 0,
                "used_tokens": token.used_tokens if token else 0,
                "last_charged_at": token.last_charged_at if token else None,
                "monthly_token_usage": int(monthly_token_usage)
            },
            "payment_info": {
                "total_payment": float(total_payment),
                "monthly_payment": float(monthly_payment)
            }
        }

        return user_detail

    except Exception as e:
        logger.error(f"Error fetching user detail: {str(e)}")
        raise e


def get_user_stats(db: Session) -> Dict:
    """사용자 통계 정보를 조회합니다."""
    try:
        # 전체 사용자 수
        total_users = db.query(func.count(User.user_id)).scalar()

        # 상태별 사용자 수
        status_counts = dict(
            db.query(
                User.status,
                func.count(User.user_id)
            ).group_by(User.status).all()
        )

        # 최근 30일 신규 가입자 수
        new_users_30d = db.query(func.count(User.user_id)).filter(
            User.created_at >= datetime.now() - timedelta(days=30)
        ).scalar()

        # 토큰 사용량 통계
        token_stats = db.query(
            func.avg(TokenUsageHistory.tokens_used).label('avg_usage'),
            func.max(TokenUsageHistory.tokens_used).label('max_usage'),
            func.min(TokenUsageHistory.tokens_used).label('min_usage')
        ).filter(
            TokenUsageHistory.used_at >= datetime.now() - timedelta(days=30)
        ).first()

        # 토큰 사용량 구간별 사용자 수
        token_usage_distribution = dict(
            db.query(
                case(
                    (func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0) >= 1000, 'high'),
                    (func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0) >= 500, 'medium'),
                    else_='low'
                ).label('usage_level'),
                func.count(distinct(TokenUsageHistory.user_id))
            ).filter(
                TokenUsageHistory.used_at >= datetime.now() - timedelta(days=30)
            ).group_by('usage_level').all()
        )

        return {
            "total_users": total_users,
            "status_distribution": {
                "active": status_counts.get('ACTIVE', 0),
                "inactive": status_counts.get('INACTIVE', 0),
                "banned": status_counts.get('BANNED', 0),
                "withdrawn": status_counts.get('WITHDRAWN', 0)
            },
            "new_users_last_30_days": new_users_30d,
            "token_usage_stats": {
                "average_usage": float(token_stats.avg_usage or 0),
                "max_usage": int(token_stats.max_usage or 0),
                "min_usage": int(token_stats.min_usage or 0)
            },
            "token_usage_distribution": {
                "high": token_usage_distribution.get('high', 0),
                "medium": token_usage_distribution.get('medium', 0),
                "low": token_usage_distribution.get('low', 0)
            }
        }

    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        raise e


def delete_user(db: Session, user_id: str) -> bool:
    """
    사용자를 비활성화 처리합니다.
    실제 삭제가 아닌 상태를 WITHDRAWN으로 변경합니다.

    Args:
        db (Session): 데이터베이스 세션
        user_id (str): 비활성화할 사용자 ID

    Returns:
        bool: 성공 여부
    """
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return False

        # 실제 삭제 대신 상태 변경
        user.status = 'WITHDRAWN'
        user.deleted_at = datetime.now()

        db.commit()
        return True

    except Exception as e:
        db.rollback()
        logger.error(f"Error deactivating user: {str(e)}")
        raise