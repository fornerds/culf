from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

curator_tags = Table(
    'curator_tags',
    Base.metadata,
    Column('curator_id', Integer, ForeignKey('curators.curator_id', ondelete='CASCADE')),
    Column('tag_id', Integer, ForeignKey('tags.tag_id', ondelete='CASCADE'))
)


class Tag(Base):
    __tablename__ = "tags"

    tag_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)

    # relationship
    curators = relationship(
        "Curator",
        secondary=curator_tags,
        back_populates="tags"
    )


class Curator(Base):
    __tablename__ = "curators"

    curator_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    persona = Column(String(100), nullable=True)
    main_image = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)
    introduction = Column(Text)
    category = Column(String)

    tags = relationship(
        "Tag",
        secondary=curator_tags,
        back_populates="curators"
    )
    tag_histories = relationship("CuratorTagHistory", back_populates="curator", cascade="all, delete-orphan")


class CuratorTagHistory(Base):
    __tablename__ = "curator_tags_history"

    history_id = Column(Integer, primary_key=True, autoincrement=True)
    curator_id = Column(Integer, ForeignKey('curators.curator_id'), nullable=False)
    tag_names = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    curator = relationship("Curator", back_populates="tag_histories")
