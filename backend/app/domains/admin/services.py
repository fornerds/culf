from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc, case, distinct
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from app.domains.admin.models import SystemSetting
from app.domains.admin.schemas import NotificationCreate, TokenPlanUpdate, SubscriptionPlanUpdate
from app.domains.notice.models import Notice
from app.domains.notification.models import Notification, UserNotification
from app.domains.subscription.models import SubscriptionPlan
from app.domains.user.models import User
from app.domains.token.models import Token, TokenUsageHistory, TokenGrant, TokenPlan
from app.domains.conversation.models import Conversation
from app.domains.payment.models import Payment
import logging
from uuid import UUID

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
        func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0).label('monthly_token_usage'),
        func.max(Conversation.question_time).label('question_time')
    ).outerjoin(
        Token, User.user_id == Token.user_id
    ).outerjoin(
        TokenUsageHistory,
        (User.user_id == TokenUsageHistory.user_id) &
        (TokenUsageHistory.used_at >= datetime.now() - timedelta(days=30))
    ).outerjoin(
        Conversation,
        User.user_id == Conversation.user_id
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
    for user, total_tokens, monthly_usage, question_time in results:
        users.append({
            "user_id": str(user.user_id),
            "nickname": user.nickname,
            "email": user.email,
            "created_at": user.created_at,
            "status": user.status,
            "role": user.role,
            "total_tokens": total_tokens or 0,
            "monthly_token_usage": int(monthly_usage or 0),
            "last_chat_at": question_time
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
        func.coalesce(func.sum(TokenUsageHistory.tokens_used), 0).label('monthly_token_usage'),
        func.max(Conversation.question_time).label('question_time')
    ).outerjoin(
        Token, User.user_id == Token.user_id
    ).outerjoin(
        TokenUsageHistory,
        (User.user_id == TokenUsageHistory.user_id) &
        (TokenUsageHistory.used_at >= datetime.now() - timedelta(days=30))
    ).outerjoin(
        Conversation,
        User.user_id == Conversation.user_id
    ).group_by(User.user_id, Token.total_tokens)

    results = query.all()
    users = []
    for user, total_tokens, monthly_usage, question_time in results:
        users.append({
            "nickname": user.nickname,
            "email": user.email,
            "created_at": user.created_at,
            "last_chat_at": question_time,
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

def get_admin_notifications(
        db: Session,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
) -> Tuple[List[dict], int]:
    """관리자용 알림 목록 조회"""
    query = db.query(Notification)

    if search:
        query = query.filter(Notification.message.ilike(f"%{search}%"))

    # 전체 개수 조회
    total = query.count()

    # 알림 목록 조회 with 통계
    notifications = []
    query_results = query.order_by(Notification.created_at.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    for notif in query_results:
        # 각 알림별 읽음 상태 통계 조회
        # case when 구문 수정
        stats = db.query(
            func.count(UserNotification.user_id).label('total_recipients'),
            func.sum(case(
                (UserNotification.is_read == True, 1),
                else_=0
            )).label('read_count')
        ).filter(
            UserNotification.notification_id == notif.notification_id
        ).first()

        notifications.append({
            "notification_id": notif.notification_id,
            "type": notif.type.value,
            "message": notif.message,
            "created_at": notif.created_at,
            "total_recipients": stats.total_recipients or 0,
            "read_count": int(stats.read_count or 0)  # None 처리를 위해 int 변환
        })

    return notifications, total

def create_notification(
        db: Session,
        notification_data: NotificationCreate,
) -> Notification:
    """새로운 알림 생성"""
    try:
        # 알림 생성
        db_notification = Notification(
            type=notification_data.type,
            message=notification_data.message
        )
        db.add(db_notification)
        db.flush()

        # 수신자 지정
        if notification_data.user_ids:
            # 특정 사용자들에게만 알림 전송
            for user_id_str in notification_data.user_ids:
                user_id = UUID(user_id_str)
                user_notification = UserNotification(
                    user_id=user_id,
                    notification_id=db_notification.notification_id
                )
                db.add(user_notification)
        else:
            # 전체 사용자에게 알림 전송
            users = db.query(User).filter(User.status == 'ACTIVE').all()
            for user in users:
                user_notification = UserNotification(
                    user_id=user.user_id,
                    notification_id=db_notification.notification_id
                )
                db.add(user_notification)

        db.commit()
        db.refresh(db_notification)
        return db_notification

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating notification: {str(e)}")
        raise


def delete_notification(
        db: Session,
        notification_id: int
) -> bool:
    """알림 삭제"""
    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id
    ).first()

    if notification:
        db.delete(notification)
        db.commit()
        return True
    return False


def mark_notification_as_read(
        db: Session,
        notification_id: int,
        user_id: UUID
) -> bool:
    """알림을 읽음 처리"""
    user_notification = db.query(UserNotification).filter(
        UserNotification.notification_id == notification_id,
        UserNotification.user_id == user_id
    ).first()

    if user_notification:
        user_notification.is_read = True
        user_notification.read_at = datetime.now()
        db.commit()
        return True
    return False


def get_notification_read_status(db: Session, notification_id: int) -> List[dict]:
    """알림의 읽음 상태 상세 정보를 조회합니다."""
    query = db.query(
        UserNotification,
        User
    ).join(
        User,
        UserNotification.user_id == User.user_id
    ).filter(
        UserNotification.notification_id == notification_id
    ).order_by(
        UserNotification.read_at.desc().nullsfirst(),
        User.nickname
    )

    results = query.all()

    status_details = []
    for user_notification, user in results:
        status_details.append({
            "user_id": str(user.user_id),
            "email": user.email,
            "nickname": user.nickname,
            "is_read": user_notification.is_read or False,
            "read_at": user_notification.read_at
        })

    return status_details

def get_admin_notices(db: Session, page: int = 1, limit: int = 10, search: Optional[str] = None):
    query = db.query(Notice)

    if search:
        query = query.filter(
            or_(
                Notice.title.ilike(f"%{search}%"),
                Notice.content.ilike(f"%{search}%")
            )
        )

    total_count = query.count()
    notices = query.order_by(desc(Notice.created_at)).offset((page - 1) * limit).limit(limit).all()

    return notices


def get_admin_notice(db: Session, notice_id: int):
    return db.query(Notice).filter(Notice.notice_id == notice_id).first()


def create_notice(db: Session, notice_data: dict):
    notice = Notice(**notice_data)
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


def update_admin_notice(db: Session, notice_id: int, update_data: dict):
    notice = get_admin_notice(db, notice_id)
    for key, value in update_data.items():
        setattr(notice, key, value)
    db.commit()
    db.refresh(notice)
    return notice


def delete_admin_notice(db: Session, notice_id: int):
    notice = get_admin_notice(db, notice_id)
    db.delete(notice)
    db.commit()


def get_welcome_tokens(db: Session) -> Dict[str, int]:
    """가입 축하 스톤 설정을 조회합니다."""
    setting = db.query(SystemSetting).filter(
        SystemSetting.key == 'welcome_tokens'
    ).first()
    return {"welcome_tokens": int(setting.value) if setting else 0}


def update_welcome_tokens(db: Session, tokens: int) -> Dict[str, int]:
    """가입 축하 스톤 설정을 업데이트합니다."""
    try:
        setting = db.query(SystemSetting).filter(
            SystemSetting.key == 'welcome_tokens'
        ).first()

        if setting:
            setting.value = str(tokens)
            setting.updated_at = datetime.now()
        else:
            setting = SystemSetting(
                key='welcome_tokens',
                value=str(tokens),
                updated_at=datetime.now()
            )
            db.add(setting)

        db.commit()
        return {"welcome_tokens": tokens}
    except Exception as e:
        db.rollback()
        raise e
def grant_tokens_to_user(
    db: Session,
    email: str,  # UUID 대신 email로 변경
    amount: int,
    reason: str,
    admin_id: UUID
) -> Dict:
    """특정 사용자에게 스톤을 지급합니다."""
    try:
        # 이메일로 사용자 조회
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise ValueError("해당 이메일의 사용자를 찾을 수 없습니다.")

        if user.status != 'ACTIVE':
            raise ValueError("비활성 사용자에게는 스톤을 지급할 수 없습니다.")

        # 토큰 정보 조회 또는 생성
        token = db.query(Token).filter(Token.user_id == user.user_id).first()
        if not token:
            token = Token(user_id=user.user_id, total_tokens=0)
            db.add(token)

        # 토큰 지급 이력 생성
        token_grant = TokenGrant(
            user_id=user.user_id,
            amount=amount,
            reason=reason,
            granted_by=admin_id
        )
        db.add(token_grant)

        # 토큰 잔액 업데이트
        token.total_tokens += amount
        token.last_charged_at = datetime.now()

        db.commit()
        db.refresh(token)
        db.refresh(token_grant)

        return {
            "token_grant_id": token_grant.token_grant_id,
            "user_email": user.email,
            "amount": amount,
            "reason": reason,
            "granted_by": admin_id,
            "created_at": token_grant.created_at,
            "user_nickname": user.nickname,
            "current_balance": token.total_tokens
        }

    except Exception as e:
        db.rollback()
        raise e


def update_subscription_plan(
        db: Session,
        plan_id: int,
        plan_update: SubscriptionPlanUpdate
) -> SubscriptionPlan:
    """구독 상품을 수정합니다."""
    try:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == plan_id).first()
        if not plan:
            raise ValueError("해당 상품을 찾을 수 없습니다.")

        update_data = plan_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(plan, field, value)

        plan.updated_at = datetime.now()

        db.commit()
        db.refresh(plan)
        return plan
    except Exception as e:
        db.rollback()
        raise e


def update_token_plan(
        db: Session,
        plan_id: int,
        plan_update: TokenPlanUpdate
) -> TokenPlan:
    """일반 상품을 수정합니다."""
    try:
        plan = db.query(TokenPlan).filter(TokenPlan.token_plan_id == plan_id).first()
        if not plan:
            raise ValueError("해당 상품을 찾을 수 없습니다.")

        update_data = plan_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(plan, field, value)

        plan.updated_at = datetime.now()

        db.commit()
        db.refresh(plan)
        return plan
    except Exception as e:
        db.rollback()
        raise e