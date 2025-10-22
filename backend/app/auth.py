from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import  HTTPException, status, Security
from fastapi.security import OAuth2PasswordBearer
import os, logging
from dotenv import load_dotenv


#Chave secreta
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "CHAVE_SECRETA")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
LIMITE_TENTATIVAS = int(os.getenv("LIMITE_TENTATIVAS", "50"))
TEMPO_BLOQUEIO = int(os.getenv("TEMPO_BLOQUEIO", "1000"))  # em segundos

logger = logging.getLogger(__name__)

try:
    import redis
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None

    if REDIS_PASSWORD:
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, password=REDIS_PASSWORD, decode_responses=True)
    else:
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)

    # valida conexão
    try:
        redis_client.ping()
    except Exception as e:
        logger.warning("Redis ping falhou: %s — usando fallback em memória", e)
        raise
except Exception:
    # fallback simples em memória (não thread-safe e não persistente)
    logger.warning("Redis indisponível — usando fallback em memória (apenas para dev).")
    class _DummyRedis:
        def __init__(self):
            self._m = {}
        def get(self, k): return self._m.get(k)
        def incr(self, k):
            v = int(self._m.get(k, 0)) + 1
            self._m[k] = v
            return v
        def expire(self, k, t): pass
        def delete(self, k):
            if k in self._m: del self._m[k]
    redis_client = _DummyRedis()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/login")

def chave_login(email: str, ip: str) -> str:
    em = (email or "").strip().lower()
    ip = (ip or "unknown")
    return f"login_attempts:{em}:{ip}"


def criar_token_acesso(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verificar_token(token: str = Security(oauth2_scheme)) -> int:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        try:
            admin_id = int(sub)
        except Exception:
            raise credentials_exception
        return admin_id
    except JWTError:
        raise credentials_exception

def pode_tentar_login(email: str, ip: str) -> bool:
    key = chave_login(email, ip)
    try:
        tentativas = redis_client.get(key)
        if tentativas and int(tentativas) >= LIMITE_TENTATIVAS:
            return False
    except Exception as e:
        logger.warning("Erro ao acessar Redis: %s", e)
        return True
    return True


def registra_erro_login(email: str, ip: str) -> None:
    key = chave_login(email, ip)
    try:       
        tentativas = redis_client.incr(key)
        if tentativas == 1:
            try:
                redis_client.expire(key, TEMPO_BLOQUEIO)
            except Exception:
                pass
    except Exception as e:
        logger.warning("Erro ao acessar Redis: %s", e)


def limpa_tentativas(email: str, ip: str) -> None:
    key = chave_login(email, ip)
    try:
        redis_client.delete(key)
    except Exception as e:
        logger.warning("Erro ao acessar Redis: %s", e)
        
    