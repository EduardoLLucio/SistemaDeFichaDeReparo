from enum import Enum
from pydantic import BaseModel, EmailStr, constr, validator
from typing import Optional
from datetime import datetime
import re

class StatusEnum(str, Enum):
    ABERTA = "ABERTA"
    EM_ANALISE = "EM_ANALISE"
    AGUARDANDO_PECA = "AGUARDANDO_PECA"
    EM_REPARO = "EM_REPARO"
    FINALIZADA = "FINALIZADA"
    ENTREGUE = "ENTREGUE"
    CANCELADA = "CANCELADA"

# Admin
class AdminBase(BaseModel):
    email: EmailStr


class AdminCreate(BaseModel):
    password: constr(min_length=8)

class AdminOut(BaseModel):
    id: int
    email: EmailStr
    criado_em: datetime
    class Config:
        orm_mode = True

class AdminLogin(BaseModel):
    email: EmailStr
    password: str
    
    class Config:
        orm_mode = True

# Cliente
class ClienteBase(BaseModel):
    nome: constr(strip_whitespace=True, min_length=1, max_length=255)
    telefone: constr(strip_whitespace=True, min_length=10, max_length=20)
    email: Optional[EmailStr] = None
    endereco: Optional[constr(max_length=512)] = None
    numero: Optional[constr(max_length=64)] = None
    bairro: Optional[constr(max_length=255)] = None

class ClienteCreate(ClienteBase):

    @validator('telefone', pre=True)
    def validar_telefone(cls, v):
        if v is None:
            raise ValueError('Telefone é obrigatório.')
        s = str(v).strip()
        s = re.sub(r'(?!^\+)\D', '', s)
        if not re.match(r'^\+?\d{10,15}$', s):
            raise ValueError('Telefone inválido. Use 10-15 dígitos, opcional +')
        return s

class ClienteOut(ClienteBase):
    id: int
    criado_em: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class ClienteUpdate(BaseModel):
    nome: Optional[constr(max_length=255)] = None
    telefone: Optional[constr(max_length=20)] = None
    email: Optional[EmailStr] = None
    endereco: Optional[constr(max_length=512)] = None
    numero: Optional[constr(max_length=64)] = None
    bairro: Optional[constr(max_length=255)] = None
    
    class Config:
        orm_mode = True

# Ficha
class FichaBase(BaseModel):
    categoria: constr(strip_whitespace=True, max_length=128)
    marca: constr(strip_whitespace=True, max_length=128)
    modelo: constr(strip_whitespace=True, max_length=128)
    serial: Optional[constr(strip_whitespace=True, max_length=128)] = None
    descricao: constr(strip_whitespace=True, max_length=512)
    status: Optional[StatusEnum] = StatusEnum.ABERTA  # Default status
    codigo_rastreio: Optional[constr(strip_whitespace=True, max_length=128)] = None
    defeito: Optional[constr(strip_whitespace=True, max_length=2000)] = None
    acessorios: Optional[constr(strip_whitespace=True, max_length=2000)] = None
    previsao_entrega: Optional[constr(strip_whitespace=True, max_length=128)] = None
    valor: Optional[float] = None

class FichaCreate(FichaBase):
    defeito: constr(strip_whitespace=True, min_length=1, max_length=2000)

    @validator('defeito', pre=True, always=True)
    def validar_defeito(cls, v):
        if v is None or not str(v).strip():
            raise ValueError('Defeito é obrigatório.')
        return str(v).strip()

class FichaOut(FichaBase):
    id: int
    data_criacao: datetime
    observacao_publica: Optional[str] = None
    observacao_privada: Optional[str] = None
    cliente: ClienteOut
    
    class Config:
        orm_mode = True
        use_enum_values = True

class FichaUpdate(BaseModel):
    categoria: Optional[constr(max_length=128)] = None
    marca: Optional[constr(max_length=128)] = None
    modelo: Optional[constr(max_length=128)] = None
    serial: Optional[constr(max_length=128)] = None
    descricao: Optional[constr(max_length=4000)] = None
    status: Optional[StatusEnum] = None
    codigo_rastreio: Optional[constr(max_length=128)] = None
    observacao_publica: Optional[constr(max_length=2000)] = None
    observacao_privada: Optional[constr(max_length=2000)] = None
    previsao_entrega: Optional[constr(max_length=128)] = None
    valor: Optional[float] = None
    defeito: Optional[str] = None
    acessorios: Optional[str] = None
    class Config:
        orm_mode = True
        use_enum_values = True

# Log
class LogBase(BaseModel):
    status: Optional[str] = ""
    descricao: Optional[str] = None

class LogCreate(LogBase):
    ficha_id: int

class LogOut(LogBase):
    id: int
    data: datetime
    ficha_id: int
    
    class Config:
        orm_mode = True