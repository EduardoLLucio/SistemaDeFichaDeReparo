from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Security, Request, UploadFile, File, Response


from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse, StreamingResponse 
import os
import uuid
import shutil
import io
import traceback
import re


from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from . import models, schemas, crud
from .database import get_db, engine, Base
from .auth import criar_token_acesso, verificar_token, pode_tentar_login, registra_erro_login, limpa_tentativas
from .mail_utils import enviar_email
from .pdf_utils import ficha_to_pdf_bytes
from dateutil.relativedelta import relativedelta
from collections import defaultdict
from datetime import datetime, timedelta
import logging
from PIL import Image



logger = logging.getLogger(__name__)

logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)

APP_ENV = os.getenv("APP_ENV", "development").lower()

frontends = os.getenv("FRONTEND_URLS") or os.getenv("FRONTEND_URL") or "http://localhost:3000"
ALLOWED_ORIGINS = [u.strip() for u in frontends.split(",") if u.strip()]

if APP_ENV == "production" and any(o == "*" for o in ALLOWED_ORIGINS):
    raise ValueError("Em produção, FRONTEND_URLS não pode conter '*'")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(__file__)
STATIC_DIR = os.path.join(BASE_DIR, 'static')
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if APP_ENV != "production" and os.getenv("INIT_DB", "false").lower() in ("1", "true", "yes"):
    Base.metadata.create_all(bind=engine)



# Handlers de exceção 

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning("HTTP exception: %s %s", exc.status_code, exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail or "Erro HTTP inesperado."})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Request validation error: %s", exc)
    return JSONResponse(status_code=422, content={"detail": exc.errors()})
    
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Erro interno não tratado")
    if APP_ENV != "production":
        return JSONResponse(status_code=500, content={"detail": "Erro interno inesperado. Veja logs do servidor."})
    return JSONResponse(status_code=500, content={"detail": "Erro interno inesperado. Tente novamente mais tarde."})
    


#Admin

@app.post('/admin/login')
def login_admin(payload: schemas.AdminLogin, request: Request, db: Session = Depends(get_db), response: Response = None):
    
    email = payload.email
    senha = payload.password
    ip = request.client.host
    
   
    
    if not pode_tentar_login(email, ip):
        raise HTTPException(status_code=429, detail="Muitas tentativas de login. Tente novamente mais tarde.")
    
    admin = crud.autenticar_admin(db, email, senha)
    if not admin:
        registra_erro_login(email, ip)
        raise HTTPException(status_code=401, detail="Email ou senha invalidos")
    
    #Registrar o log de acesso
    try:
        crud.registrar_log_acesso(db, admin.id, "login", f"IP: {ip}")
    except Exception:
        logger.exception("Erro ao registrar log de acesso")
        
    limpa_tentativas(email, ip)
    access_token = criar_token_acesso({"sub": str(admin.id)})
    
    USE_COOKIE_BACKEND = os.getenv("USE_COOKIE_BACKEND", "false").lower() in ("1", "true", "yes")
    if USE_COOKIE_BACKEND and response is not None:
        secure = APP_ENV == "production"
        expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        max_age = expire_minutes * 60  # em segundos
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=secure,
            samesite="lax",
            max_age=max_age,
            expires=max_age,
            path="/",
        )
        return {"token_type": "cookie"}
    
    return {"access_token": access_token, "token_type": "bearer"}


#Cliente

@app.post('/clientes')
def criar_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    return crud.criar_cliente(db, cliente, admin_id)


@app.get("/clientes")
def listar_clientes(q: str = "", page: int = 1, page_size: int = 12, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    
    
    query = db.query(models.Cliente).filter(models.Cliente.admin_id == admin_id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(models.Cliente.nome.ilike(like),
                models.Cliente.telefone.ilike(like)))
        
    total = query.count()
    items = query.order_by(models.Cliente.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": jsonable_encoder(items), "total": total}



@app.get("/clientes/search")
def buscar_clientes(q: str, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    if not q or len(q.strip()) < 2:
        return []
    like = f"%{q.strip()}%"
    resultados = ( 
            db.query(models.Cliente)
            .filter(
                and_(
                    models.Cliente.admin_id == admin_id,
                    or_(
                        models.Cliente.nome.ilike(like), 
                        models.Cliente.telefone.ilike(like)
                        )
                    )
            )
            .order_by(models.Cliente.nome.asc())
            .limit(10)  
            .all()
    )
    return jsonable_encoder(resultados)


@app.get('/clientes/{cliente_id}')
def cliente_detalhe(cliente_id: int, limit: int = 10, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    cliente = crud.buscar_cliente_por_id(db, cliente_id, admin_id=admin_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    fichas = (db.query(models.Ficha)
              .filter(models.Ficha.cliente_id == cliente_id)
              .order_by(models.Ficha.id.desc())
              .limit(limit)
              .all())
    return {'cliente': jsonable_encoder(cliente), 'fichas': jsonable_encoder(fichas)}


@app.put('/clientes/{cliente_id}')
def atualizar_cliente_endpoint(cliente_id: int, payload: schemas.ClienteUpdate, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
   
    cliente = crud.buscar_cliente_por_id(db, cliente_id, admin_id=admin_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    dados = payload.dict(exclude_unset=True)
    atualizado = crud.atualizar_cliente(db, cliente_id, dados)
    if not atualizado:
        raise HTTPException(status_code=404, detail="Falha ao atualizar cliente")
    return jsonable_encoder(atualizado)



@app.get('/clientes/{cliente_id}/fichas')
def historico_fichas_cliente(cliente_id: int, page: int = 1, page_size: int = 12, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    
    cliente = crud.buscar_cliente_por_id(db, cliente_id, admin_id=admin_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
    
    query = db.query(models.Ficha).filter(models.Ficha.cliente_id == cliente_id)
    total = query.count()
    items = (
        query.order_by(models.Ficha.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all())
    return {"items": jsonable_encoder(items), "total": total}



@app.get('/rastreio/{codigo}')
def rastreio_publico(codigo: str, db: Session = Depends(get_db)):
    ficha = crud.buscar_ficha_por_codigo(db, codigo)
    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    
    
    return {
        "codigo_rastreio": getattr(ficha, "codigo_rastreio", None),
        "status": getattr(ficha, "status", None),
        "defeito": getattr(ficha, "defeito", None),
        "previsao_entrega": getattr(ficha, "previsao_entrega", None),
        "observacao_publica": getattr(ficha, "observacao_publica", None),
        "cliente_em": ficha.data_criacao.isoformat() if getattr(ficha, "data_criacao", None) else None,
    }

    

#Ficha

@app.post('/fichas/{cliente_id}')
async def criar_ficha(
    cliente_id: int, 
    ficha: schemas.FichaCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), 
    admin_id: int = Security(verificar_token),                     
):
    
    try:
        nova_ficha = crud.criar_ficha(db, ficha, cliente_id, admin_id=admin_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    cliente = crud.buscar_cliente_por_id(db, cliente_id, admin_id=admin_id)
    if cliente and getattr(cliente, "email", None):
        try:
            enviar_email(cliente.email, f'Ficha {nova_ficha.codigo_rastreio} criada', f'Sua ficha {nova_ficha.codigo_rastreio} foi criada', background_tasks)
        except Exception:
            logger.exception("Falha ao agendar envio de email (não crítico)")
    return jsonable_encoder(nova_ficha)




@app.get('/fichas')
def listar_fichas(q: str = "", status: str = "", data_ini: str = "", data_fim: str = "", page: int = 1, page_size: int = 12, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    
    query = db.query(models.Ficha, models.Cliente.nome.label("cliente")).join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id).filter(models.Cliente.admin_id == admin_id)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.Ficha.codigo_rastreio.ilike(like),
                models.Cliente.nome.ilike(like),   
                models.Ficha.marca.ilike(like),
                models.Ficha.modelo.ilike(like),                                
            )
        )
            
    if status:
        query = query.filter(models.Ficha.status.ilike(f"%{status}%"))
        
    if data_ini:
        try:
            dt = datetime.fromisoformat(data_ini)
            query = query.filter(models.Ficha.data_criacao >= dt)
        except ValueError:
            pass
        
    if data_fim:
        try:
            dt = datetime.fromisoformat(data_fim)
            query = query.filter(models.Ficha.data_criacao < dt)
        except ValueError:
            pass
            
    total = query.count()
    rows = query.order_by(models.Ficha.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
     
    items = [
        {           
            "id": f.id,
            "status": f.status,
            "cliente": cliente_nome,
            "marca": f.marca,
            "modelo": f.modelo,
            "numero_serie": f.serial,
            "criado_em": f.data_criacao.isoformat() if getattr(f, "data_criacao", None) else None,
            "defeito": getattr(f, "defeito", None),
            "acessorios": getattr(f, "acessorios", None),
            "previsao_entrega": getattr(f, "previsao_entrega", None),
            "valor": getattr(f, "valor", None),
            "descricao": getattr(f, "descricao", None),
            "codigo_rastreio": getattr(f, "codigo_rastreio", None),
            
                
        }
        for f, cliente_nome in rows
    
    ]
    return {"items": items, "total": total}



@app.get('/fichas/codigo/{codigo}')
def buscar_ficha(codigo: str, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    ficha = crud.buscar_ficha_por_codigo(db, codigo, admin_id=admin_id)
    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    return jsonable_encoder(ficha)


#Logs

@app.post("/fichas/{ficha_id}/logs")
def criar_log(ficha_id: int, log: schemas.LogCreate, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    try:
        return crud.criar_log(db, ficha_id, log, admin_id=admin_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/fichas/{ficha_id}/logs")
def listar_logs(ficha_id: int, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    return crud.listar_logs_por_ficha(db, ficha_id, admin_id=admin_id)





@app.put('/fichas/{ficha_id}')
def atualizar_ficha_endpoint(ficha_id: int, payload: schemas.FichaUpdate, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    dados =payload.dict(exclude_unset=True)
    atualizando = crud.atualizar_ficha(db, ficha_id, dados, admin_id=admin_id)
    if not atualizando:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    return jsonable_encoder(atualizando)




@app.get('/fichas/{ficha_id}/pdf')
def ficha_pdf(ficha_id: int, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    ficha = db.query(models.Ficha).filter(models.Ficha.id == ficha_id).first()
    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    cliente = db.query(models.Cliente).filter(models.Cliente.id == ficha.cliente_id).first()
    if cliente and cliente.admin_id is not None and cliente.admin_id != admin_id:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    
    cliente_data = {
        "id": getattr(cliente, "id", None),
        "nome": getattr(cliente, "nome", "") or "",
        "telefone": getattr(cliente, "telefone", "") or "",
        "email": getattr(cliente, "email", "") or "",
        "endereco": getattr(cliente, "endereco", "") or "",
        "numero": getattr(cliente, "numero", "") or "",
        "bairro": getattr(cliente, "bairro", "") or "",
    }

    context = {
        "ficha": {
            "id": ficha.id,
            "categoria": ficha.categoria or "",
            "marca": ficha.marca or "",
            "modelo": ficha.modelo or "",
            "serial": ficha.serial or "",
            "descricao": ficha.descricao or "",
            "defeito": getattr(ficha, "defeito", "") or "",
            "acessorios": getattr(ficha, "acessorios", "") or "",
            "codigo_rastreio": ficha.codigo_rastreio or "",
        },
        "cliente": cliente_data,
        "base_url": os.getenv("BASE_URL", "http://localhost:3000"),
    }

    wkpath = os.getenv("WKHTMLTOPDF_PATH")
    try:
        pdf_bytes = ficha_to_pdf_bytes(context, wkhtmltopdf_path=wkpath)
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro ao gerar o PDF da ficha.")

    # registra log de impressão (não deve bloquear a resposta)
    try:
        # usa o nome em PT se esse é o disponível no crud
        crud.registrar_log_acesso(db, admin_id, "gerar_pdf", f"Ficha ID: {ficha.id}")
    except Exception:
        db.rollback()

    filename = f"ficha_{ficha.id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
    
    
@app.get('/fichas/{ficha_id}/detail')
def ficha_detail(ficha_id: int, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    ficha = db.query(models.Ficha).filter(models.Ficha.id == ficha_id).first()
    if not ficha:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    cliente = db.query(models.Cliente).filter(models.Cliente.id == ficha.cliente_id).first()
    if cliente and cliente.admin_id is not None and cliente.admin_id != admin_id:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    logs = db.query(models.LogAtualizacao).filter(models.LogAtualizacao.ficha_id == ficha_id).order_by(models.LogAtualizacao.data.desc()).all()
    return {'ficha': jsonable_encoder(ficha), 'cliente': jsonable_encoder(cliente), 'logs': jsonable_encoder(logs)}
    

@app.get('/minhas-fichas')
def minhas_fichas(page: int = 1, page_size: int = 20, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
   
    all_items = crud.listar_fichas_para_admin(db, admin_id, limit=1000)
    # paginação simples em memória (pode mudar para query paginada no DB)
    start = (max(1, page) - 1) * max(1, page_size)
    end = start + max(1, page_size)
    items_page = all_items[start:end]
    return {"items": jsonable_encoder(items_page), "total": len(all_items)}


@app.get('/fichas/estatisticas')  
def fichas_estatisticas(limit_months: int = 6, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    
    rows = (
        db.query(models.Ficha).join(models.Cliente, models.Ficha.cliente_id == models.Cliente.id).filter(models.Cliente.admin_id == admin_id).all()
    )
    counts = defaultdict(int)
    for r in rows:
        dt = getattr(r, "data_criacao", None)
        if not dt:
            continue
        key = dt.strftime("%Y-%m")
        counts[key] += 1

    now = datetime.utcnow()
    out = []
    for i in range(limit_months - 1, -1, -1):
        target = now + relativedelta(months=-i)
        key = target.strftime("%Y-%m")
        label = target.strftime("%b %Y")
       
        out.append({"mes": label, "key": key, "total": int(counts.get(key, 0))})
    return out





@app.get("/logs")
def listar_logs_acesso(page: int = 1, page_size: int = 20, db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    
    query = db.query(models.LogAcesso).filter(models.LogAcesso.admin_id == admin_id)
    total = query.count()
    data = query.order_by(models.LogAcesso.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = []
    
    for l in data:
        detalhe = l.detalhe or ""
        m = re.search(r"IP:\s*([0-9a-fA-F:\.]+)", detalhe)
        origem = m.group(1) if m else "-"
        mensagem = (l.acao or "").strip() or detalhe or "-"
        items.append(
            {
                "id": l.id,
                "usuario": getattr(l, "usuario", None) or "-",
                "acao": l.acao,
                "detalhe": detalhe,
                "mensagem": mensagem,
                "origem": origem,
                "nivel": getattr(l, "nivel", "INFO"),
                "data": l.data.isoformat() if getattr(l, "data", None) else None,
            }
        )
    return {"items": items, "total": total}
# ...existing code...

    



@app.post('/upload-foto')
def upload_foto(foto: UploadFile = File(...), db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    
    contents = foto.file.read()
    max_size = 11 * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Tamanho máximo permitido é 11MB.")  
    
    if foto.content_type not in ['image/jpeg', 'image/png', 'image/webp']:
        raise HTTPException(status_code=400, detail="Formato de arquivo inválido. Apenas JPEG e PNG ou WEBP são permitidos.")
    
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()  # Verifica se é uma imagem válida
        fmt = (img.format or "").lower()
        if fmt == "jpeg":
            ext = "jpg"
        elif fmt in ("png", "webp"):
            ext = fmt
        else:
            raise HTTPException(status_code=400, detail="Formato de arquivo inválido. Apenas JPEG e PNG ou WEBP são permitidos.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Erro ao processar imagem enviada")
        raise HTTPException(status_code=400, detail="Arquivo de imagem inválido ou corrompido.")
       
    admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin não encontrado")
            
    if getattr(admin, "foto_perfil", None):
        try:
            old_path = os.path.join(BASE_DIR, admin.foto_perfil.lstrip("/"))
            if os.path.isfile(old_path):
                os.remove(old_path)
        except Exception:
            logger.exception("Erro ao remover foto antiga de perfil (não crítico)")        
          
    pasta = os.path.join(STATIC_DIR, 'fotos')
    os.makedirs(pasta, exist_ok=True)
    nome = f"{admin_id}_{uuid.uuid4().hex}.{ext}"
    caminho_abs = os.path.join(pasta, nome)
    
    with open(caminho_abs, 'wb') as f:
       f.write(contents)
        
        
    caminho_rel = f"/static/fotos/{nome}"
    admin.foto_perfil = caminho_rel
    db.add(admin)
    db.commit()       
    return {"foto_perfil": caminho_rel}


@app.get('/usuario/me')
def usuario_me(db: Session = Depends(get_db), admin_id: int = Security(verificar_token)):
    admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    return {"foto_perfil": getattr(admin, "foto_perfil", None)}


#envio de email

@app.post("/exemplo-envio-email/")
def exemplo_envio_email(destinatario: str, background_tasks: BackgroundTasks, admin_id: int = Security(verificar_token)):
    ok = enviar_email(destinatario=destinatario, assunto="ficha atualizada!", corpo="<br>O status da sua ficha foi atualizado!<br>", background_tasks=background_tasks)
    if not ok:
        raise HTTPException(status_code=500, detail="Falha ao enviar email. Verifique as configurações do servidor de email.")
    return {"message": "Email enviado ou agendado para envio!"}