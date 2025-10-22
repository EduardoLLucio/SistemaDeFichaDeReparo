import os
import logging
from typing import List, Union
from dotenv import load_dotenv
from fastapi import BackgroundTasks
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType



logger = logging.getLogger(__name__)



APP_ENV = os.getenv("APP_ENV", "development").lower()
ENV_PATH = os.path.join(os.path.dirname(__file__), '.env')
if APP_ENV != "production" and os.path.isfile(ENV_PATH):
    load_dotenv(ENV_PATH)
    

MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
MAIL_SERVER = os.getenv("MAIL_SERVER")
MAIL_STARTTLS = os.getenv("MAIL_STARTTLS", "True").lower() in ("true", "1", "yes")
MAIL_SSL_TLS = os.getenv("MAIL_SSL_TLS", "False").lower() in ("true", "1", "yes")
VALIDATE_CERTS = os.getenv("MAIL_VALIDATE_CERTS", "True").lower() in ("1", "true", "yes")
USE_CREDENTIALS = os.getenv("MAIL_USE_CREDENTIALS", "True").lower() in ("1", "true", "yes")
    

EMAIL_ENABLED = bool(MAIL_SERVER and MAIL_FROM)
if not EMAIL_ENABLED:
    logger.warning("Env não configurado para envio de email (MAIL_SERVER or MAIL_FROM faltando). Emails estarão desabilitados.")

conf = None
fm = None
if EMAIL_ENABLED:
    conf = ConnectionConfig(
        MAIL_USERNAME=MAIL_USERNAME,
        MAIL_PASSWORD=MAIL_PASSWORD,
        MAIL_FROM=MAIL_FROM,
        MAIL_PORT=MAIL_PORT,
        MAIL_SERVER=MAIL_SERVER,
        MAIL_STARTTLS=MAIL_STARTTLS,
        MAIL_SSL_TLS=MAIL_SSL_TLS,
        USE_CREDENTIALS=USE_CREDENTIALS,
        VALIDATE_CERTS=VALIDATE_CERTS,
    )
    try:
        fm = FastMail(conf)
    except Exception:
        logger.exception("Erro ao configurar FastMail. Emails estarão desabilitados.")
        fm = None
        EMAIL_ENABLED = False
        
def destinatario_valido(dest: Union[str, List[str]]) -> List[str]:
    
    if isinstance(dest, str):
        dests = [d.strip() for d in dest.split(",") if d.strip()]
    elif isinstance(dest, (list, tuple)):
        dests = [str(d).strip() for d in dest]
    else:
        raise ValueError("Destinatário invalido")
    for d in dests:
        if "@" not in d or "." not in d:
            raise ValueError(f"Destinatário invalido: {d}")
    return dests


async def enviar_mensagem_async(message: MessageSchema):
    global fm
    if not EMAIL_ENABLED or fm is None:
        logger.warning("Tentativa de envio ignorada: email desabilitado.")
        return
    try:
        await fm.send_message(message)
    except Exception:
        logger.exception("Erro ao enviar email.")
        
        
def enviar_email(destinatario: Union[str, List[str]], assunto: str, corpo: str, background_tasks: BackgroundTasks) -> bool:
    if not EMAIL_ENABLED:
        logger.warning("Envio não agendado: email desabilitado por configuração.")
        return False
    try:
        recipients = destinatario_valido(destinatario)
    except ValueError as e:
        logger.warning("Erro ao validar destinatários: %s", e)
        return False
    
    
    message = MessageSchema(
        subject=assunto or "",
        recipients=recipients,
        body=corpo or "",
        subtype=MessageType.html
    )
    background_tasks.add_task(enviar_mensagem_async, message)
    return True
    