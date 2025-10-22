import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator
from sqlalchemy.engine import Engine

ENV_PATH = os.path.join(os.path.dirname(__file__), '.env')
if os.path.isfile(ENV_PATH):
    if os.getenv("APP_ENV", "development").lower() != "production":
        # só carrega .env local se não for produção
        load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")
APP_ENV = os.getenv("APP_ENV", "development").lower()

if not DATABASE_URL:
    if APP_ENV != "production":
        
        # configuração padrão para dev
        DATABASE_URL = "-+-://postgres:-@localhost:-/-"
    else:
        raise ValueError("DATABASE_URL não está definida no ambiente de produção")

pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))

connect_args = {}
DB_SSLMODE = os.getenv("DB_SSLMODE", "").strip()
if DATABASE_URL.startswith("postgresql") and DB_SSLMODE:
    connect_args["sslmode"] = DB_SSLMODE
    
engine: Engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True, 
    pool_size=pool_size, 
    max_overflow=max_overflow, 
    connect_args=connect_args,
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
Base = declarative_base()

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db(create_all: bool = False):
    if create_all and APP_ENV != "production":
        Base.metadata.create_all(bind=engine)
