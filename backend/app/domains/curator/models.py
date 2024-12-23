from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
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