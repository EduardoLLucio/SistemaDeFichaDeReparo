from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


#ADMIN

class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow, nullable=False)
    foto_perfil = Column(String(512), nullable=True)
    
    clientes = relationship("Cliente", back_populates="admin")
    
#Cliente

class Cliente(Base):
    __tablename__ = "clientes"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    telefone = Column(String(64), nullable=False)
    email = Column(String(255), unique=False)
    endereco = Column(String(512), unique=False)
    numero = Column(String(64), unique=False)
    bairro = Column(String(255), unique=False)
    criado_em = Column(DateTime, default=datetime.utcnow, nullable=False)

    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True, index=True)

    fichas = relationship("Ficha", back_populates="cliente")
    admin = relationship("Admin", back_populates="clientes")
    
#Ficha

class Ficha(Base):
    __tablename__ = "fichas"
    
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(Text, nullable=False)
    status = Column(String(64), default="ABERTA")
    categoria = Column(String(128), nullable=False)
    marca = Column(String(128), nullable=False)
    modelo = Column(String(128), nullable=False)
    serial = Column(String(128), nullable=True)
    codigo_rastreio = Column(String(128), unique=True, index=True, nullable=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)
    observacao_publica = Column(Text)
    observacao_privada = Column(Text)
    defeito = Column(Text, nullable=False)
    acessorios = Column(Text, nullable=True)
    previsao_entrega = Column(String(128), nullable=True)
    valor = Column(Float, nullable=True)
    
    
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    cliente = relationship('Cliente', back_populates='fichas')

    logs = relationship("LogAtualizacao", back_populates="ficha", cascade="all, delete-orphan")


#Log de Atualização

class LogAtualizacao(Base):
    __tablename__ = "logs"
    
    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(128), nullable=False, default="")
    descricao = Column(Text, nullable=True)
    data = Column(DateTime, default=datetime.utcnow, nullable=False)
    ficha_id = Column(Integer, ForeignKey("fichas.id", ondelete="CASCADE"), nullable=False)
    ficha = relationship("Ficha", back_populates='logs')
    
    
class LogAcesso(Base):
    __tablename__ = "logs_acesso"
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, nullable=False)
    acao = Column(String(128), nullable=False)
    detalhe = Column(String(1024), nullable=True)
    data = Column(DateTime, default=datetime.utcnow, nullable=False)


    