from sqlalchemy.orm import Session
from . import models, schemas
from fastapi import HTTPException


def get_active_footer(db: Session):
    """현재 활성화된 푸터 정보를 가져옵니다."""
    return db.query(models.Footer).filter(models.Footer.is_active == True).first()


def create_footer(db: Session, footer: schemas.FooterCreate):
    """새로운 푸터 정보를 생성합니다."""
    # 기존 활성 푸터가 있다면 비활성화
    active_footer = get_active_footer(db)
    if active_footer:
        active_footer.is_active = False

    # 새 푸터 생성
    db_footer = models.Footer(**footer.dict(), is_active=True)
    db.add(db_footer)
    db.commit()
    db.refresh(db_footer)
    return db_footer


def update_footer(db: Session, footer_id: int, footer: schemas.FooterUpdate):
    """푸터 정보를 업데이트합니다."""
    db_footer = db.query(models.Footer).filter(models.Footer.footer_id == footer_id).first()
    if not db_footer:
        raise HTTPException(status_code=404, detail="Footer not found")

    for key, value in footer.dict().items():
        setattr(db_footer, key, value)

    db.commit()
    db.refresh(db_footer)
    return db_footer


def get_footer_history(db: Session, skip: int = 0, limit: int = 100):
    """푸터 정보 변경 이력을 조회합니다."""
    return db.query(models.Footer).order_by(models.Footer.created_at.desc()).offset(skip).limit(limit).all()