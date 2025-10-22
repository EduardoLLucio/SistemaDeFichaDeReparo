from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from . import models, schemas
from passlib.context import CryptContext
from datetime import datetime
import uuid, logging
from typing import List, Optional, Dict, Any


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)



def autenticar_admin(db: Session, email: str, password: str) -> Optional[models.Admin]:

    if not email or not password:
        return None

    email_norm = (email or "").strip().lower()
    admin = db.query(models.Admin).filter(models.Admin.email == email_norm).first()
    if not admin:
        return None

    stored = getattr(admin, "hashed_password", getattr(admin, "hashed", "") or "")

    # tentativa com passlib CryptContext (global pwd_context)
    try:
        if pwd_context.verify(password, stored):
            return admin
    except ValueError:
        # senha >72 bytes - tentar truncar
        try:
            if pwd_context.verify(password[:72], stored):
                return admin
        except Exception:
            logger.warning("passlib truncated verify falhou")
    except Exception:
        logger.warning("passlib verify falhou")

    # fallback direto com bcrypt.checkpw
    try:
        import bcrypt as _bcrypt
        pw = (password or "").encode("utf-8")[:72]
        stored_b = (stored or "").encode("utf-8")
        if _bcrypt.checkpw(pw, stored_b):
            return admin
    except Exception:
        logger.exception("bcrypt fallback falhou")

    return None


#Cliente

def criar_cliente(db: Session, cliente: schemas.ClienteCreate, admin_id: int):
    data = cliente.dict(exclude_unset=True)
    if "email" in data and data["email"]:
        data["email"] = data["email"].strip().lower()
    if "telefone" in data and data["telefone"]:
        data["telefone"] = str(data["telefone"]).strip()
        
    # associar cliente ao admin que criou
    data['admin_id'] = admin_id
    db_cliente = models.Cliente(**data)
    try:
        db.add(db_cliente)
        db.commit()
        db.refresh(db_cliente)
    except IntegrityError:
        db.rollback()
        raise
    return db_cliente

def buscar_cliente_por_nome(db: Session, nome: str, admin_id: Optional[int] = None) -> List[models.Cliente]:
    if not nome:
        return []
    termo = f"%{nome.strip()}%"
    q = db.query(models.Cliente).filter(models.Cliente.nome.ilike(termo))
    if admin_id is not None:
        q = q.filter(models.Cliente.admin_id == admin_id)
    return q.order_by(models.Cliente.nome.asc()).all()

def buscar_cliente_por_id(db: Session, cliente_id: int, admin_id: Optional[int] = None) -> Optional[models.Cliente]:
    if cliente_id is None:
        return None
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        return None
    if admin_id is not None and cliente.admin_id is not None and cliente.admin_id != admin_id:
        return None
    return cliente

def atualizar_cliente(db: Session, cliente_id: int, dados: dict[str, Any]):
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        return None
    proibidos = {'id', 'created_at', 'data_criacao'}
    changed = False
    for key, value in (dados or {}).items():
        if key in proibidos:
            continue
        if not hasattr(cliente, key):
            continue
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
        setattr(cliente, key, value)
        changed = True
    if not changed:
        return cliente
    try:
        db.add(cliente)
        db.commit()
        db.refresh(cliente)
    except Exception:
        db.rollback()
        raise
    return cliente


#Ficha

def gerar_codigo_ficha(db: Session, length: int = 12, max_attempts: int = 8) -> str:
    attempts = 0
    while attempts < max_attempts:
        codigo = uuid.uuid4().hex[:length].upper()
        exists = db.query(models.Ficha).filter(models.Ficha.codigo_rastreio == codigo).first()
        if not exists:
            return codigo
        attempts += 1
    raise RuntimeError("Não foi possível gerar um código único ")
        


def criar_ficha(db: Session, ficha: schemas.FichaCreate, cliente_id: int, admin_id: Optional[int] = None):
    cliente = buscar_cliente_por_id(db, cliente_id, admin_id=admin_id)
    if not cliente:
        raise ValueError("Cliente não encontrado ou você não tem permissão")
    data = ficha.dict(exclude_unset=True)
    data['cliente_id'] = cliente_id
    # restante do código existente...
    codigo = (data.get('codigo_rastreio') or '').strip()
    if codigo:
        if db.query(models.Ficha).filter(models.Ficha.codigo_rastreio == codigo).first():
            raise ValueError("Código de rastreio já existe.")
    else:
        codigo = gerar_codigo_ficha(db)
    data["codigo_rastreio"] = codigo
    now = datetime.utcnow()
    if hasattr(models.Ficha, "data_criacao"):
        data.setdefault("data_criacao", now)
    elif hasattr(models.Ficha, "created_at"):
        data.setdefault("created_at", now)

    db_ficha = models.Ficha(**data)
    try:
        db.add(db_ficha)
        db.commit()
        db.refresh(db_ficha)
    except IntegrityError:
        db.rollback()
        raise
    return db_ficha
    

def buscar_ficha_por_codigo(db: Session, codigo: str, admin_id: Optional[int] = None) -> Optional[models.Ficha]:
    if not codigo:
        return None
    ficha = db.query(models.Ficha).filter(models.Ficha.codigo_rastreio == codigo.strip()).first()
    if not ficha:
        return None
    if admin_id is not None:
        cliente = db.query(models.Cliente).filter(models.Cliente.id == ficha.cliente_id).first()
        if not cliente or (cliente.admin_id is not None and cliente.admin_id != admin_id):
            return None
    return ficha

def listar_fichas(db: Session, admin_id: Optional[int] = None) -> List[models.Ficha]:
   
    if admin_id is None:
        return []
    q = (
        db.query(models.Ficha)
        .join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id)
        .filter(models.Cliente.admin_id == admin_id)
    )
 
    return q.order_by(models.Ficha.id.desc()).all()


def buscar_ficha_por_id(db: Session, ficha_id: str, admin_id: Optional[int] = None) -> Optional[models.Ficha]:
    if ficha_id is None:
        return None
    ficha = db.query(models.Ficha).filter(models.Ficha.id == ficha_id).first()
    if not ficha: 
        return None
    if admin_id is not None:
        cliente = db.query(models.Cliente).filter(models.Cliente.id == getattr(ficha, "cliente_id", None)).first()
        if cliente and cliente.admin_id is not None and cliente.admin_id != admin_id:
            return None 
    return ficha

def buscar_ficha_por_cliente(db: Session, cliente_id: int, admin_id: Optional[int] = None) -> List[models.Ficha]:
    if cliente_id is None:
        return []
    if admin_id is not None:
        cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
        if not cliente or (cliente.admin_id is not None and cliente.admin_id != admin_id):
            return []
    return db.query(models.Ficha).filter(models.Ficha.cliente_id == cliente_id).order_by(models.Ficha.id.desc()).all()

def buscar_ficha_por_serial(db: Session, serial: str, admin_id: Optional[int] = None) -> List[models.Ficha]:
    if not serial:
        return []
    termo = f"%{serial.strip()}%"
    q = db.query(models.Ficha).join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id)
    if admin_id is not None:
        q = q.filter(models.Cliente.admin_id == admin_id)
    return q.filter(models.Ficha.serial.ilike(termo)).all()
    

def buscar_ficha_por_status(db: Session, status: str, admin_id: Optional[int] = None) -> List[models.Ficha]:
    if not status:
        return []
    q = db.query(models.Ficha)
    if admin_id is not None:
        q = q.join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id).filter(models.Cliente.admin_id == admin_id)
    q = q.filter(models.Ficha.status == status)
    return q.order_by(models.Ficha.id.desc()).all()

def buscar_ficha_por_categoria(db: Session, categoria: str, admin_id: Optional[int] = None) -> List[models.Ficha]:
    if not categoria:
        return []
    termo = f"%{categoria.strip()}%"
    q = db.query(models.Ficha)
    if admin_id is not None:
        q = q.join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id).filter(models.Cliente.admin_id == admin_id)
    return q.filter(models.Ficha.categoria.ilike(termo)).order_by(models.Ficha.id.desc()).all()

def buscar_ficha_por_marca(db: Session, marca: str, admin_id: Optional[int] = None) -> List[models.Ficha]:
    if not marca:
        return []
    termo = f"%{marca.strip()}%"
    q = db.query(models.Ficha)
    if admin_id is not None:
        q = q.join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id).filter(models.Cliente.admin_id == admin_id)
    return q.filter(models.Ficha.marca.ilike(termo)).order_by(models.Ficha.id.desc()).all()


def atualizar_ficha(db: Session, ficha_id: int, dados: Dict[str, Any], admin_id: Optional[int] = None):
    
    ficha = db.query(models.Ficha).filter(models.Ficha.id == ficha_id).first()
    if not ficha:
        return None
    
    if admin_id is not None:
        cliente = db.query(models.Cliente).filter(models.Cliente.id == getattr(ficha, "cliente_id", None)).first()
        if cliente and cliente.admin_id is not None and cliente.admin_id != admin_id: 
            return None


    proibidos = {'id', 'created_at', 'data_criacao', 'cliente_id'}
    mudancas: Dict[str, Dict[str, Any]] = {}
    for key, value in (dados or {}).items():
        if key in proibidos:
            continue
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
        old = getattr(ficha, key, None)
        if old != value:
            setattr(ficha, key, value)
            mudancas[key] = {'old': old, 'new': value}

    if mudancas:
        try:
            db.add(ficha)
            db.commit()
            db.refresh(ficha)
        except Exception:
            db.rollback()
            raise

        try:
            detalhe = "; ".join([f"{k}: '{v['old']}' -> '{v['new']}'" for k, v in mudancas.items()])
            db_log = models.LogAtualizacao(status="", descricao=detalhe, ficha_id=ficha.id, data=datetime.utcnow())
            db.add(db_log)
            db.commit()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass        
    return ficha


def listar_fichas_para_admin(db: Session, admin_id: int, limit: int = 100) -> List[models.Ficha]:

    if admin_id is None:
        return []
    q = (
        db.query(models.Ficha)
        .join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id)
        .filter(models.Cliente.admin_id == admin_id)
    )
    # garante limite mínimo/máximo razoável
    lim = max(1, min(1000, int(limit or 100)))
    return q.order_by(models.Ficha.id.desc()).limit(lim).all()

#Log de Atualização

def criar_log(db: Session, ficha_id: int, log: schemas.LogCreate, admin_id: Optional[int] = None):
    
    if admin_id is not None:
        f = db.query(models.Ficha).filter(models.Ficha.id == ficha_id).first()
        if not f:
            raise ValueError("Ficha não encontrada")
        cliente = db.query(models.Cliente).filter(models.Cliente.id == f.cliente_id).first()
        if cliente and cliente.admin_id is not None and cliente.admin_id != admin_id:
            raise ValueError("Sem permissão para adicionar log nesta ficha")
    data = log.dict(exclude_unset=True)
    data['ficha_id'] = ficha_id
    allowed = {k: v for k, v in data.items() if hasattr(models.LogAtualizacao, k)}
    try:
        db_log = models.LogAtualizacao(**allowed)
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
    except Exception:
        db.rollback()
        raise
    return db_log
    
        
    

def listar_logs_por_ficha(db: Session, ficha_id: int, admin_id: Optional[int] = None) -> List[models.LogAtualizacao]:
    if ficha_id is None:
        return []
    
    # checar propriedade da ficha quando admin_id for informado
    if admin_id is not None:
        f = db.query(models.Ficha).filter(models.Ficha.id == ficha_id).first()
        if not f:
            return []
        cliente = db.query(models.Cliente).filter(models.Cliente.id == f.cliente_id).first()
        if cliente and cliente.admin_id is not None and cliente.admin_id != admin_id:
            return []
    q = db.query(models.LogAtualizacao).filter(models.LogAtualizacao.ficha_id == ficha_id)
    if hasattr(models.LogAtualizacao, "data"):
        q = q.order_by(models.LogAtualizacao.data.desc())
    return q.all()
    


def registrar_log_acesso(db: Session, admin_id: int, acao: str, detalhe: str = None):
    try:
        log_kwargs = {
            "admin_id": admin_id,
            "acao": acao,
            "detalhe": detalhe,
            "data": datetime.utcnow()
        }
        allowed= {k: v for k, v in log_kwargs.items() if hasattr(models.LogAcesso, k)}
        db_log = models.LogAcesso(**allowed)
        db.add(db_log)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    return
    
register_log_acesso = registrar_log_acesso
    
    
