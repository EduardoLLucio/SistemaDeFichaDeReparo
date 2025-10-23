SistemaDeFichaDeReparo é uma aplicação web para registrar, rastrear e gerenciar fichas de reparo (clientes, logs e geração de PDF). Backend em FastAPI + SQLAlchemy (Postgres) e frontend em React. Contém .env.example e instruções para rodar localmente; contas demo disponíveis para avaliação.

# SistemaDeFicha — Demo pública

Este repositório contém uma versão do SistemaDeFicha. Abaixo estão duas contas de demonstração públicas para que visitantes possam testar a aplicação em ambiente online.

## Contas demo (públicas)

- Email: `admin@admin.com`
  Senha: `Admin12345`

- Email: `admin2@admin2.com`
  Senha: `Admin123456`

**AVISO IMPORTANTE**

- Essas contas são apenas para demonstração pública. Não use essas credenciais em produção.
- As senhas acima são públicas — qualquer pessoa pode acessá-las. Troque ou remova essas contas no ambiente de produção.

## Instruções essenciais (rápido)

Backend (exemplo):

1. Crie e ative um ambiente virtual (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Instale dependências (`requirements.txt`):

```powershell
pip install -r backend/requirements.txt
```

3. Configure variáveis de ambiente em `backend/app/.env` :
- DATABASE_URL
- SECRET_KEY
- MAIL_USERNAME, MAIL_PASSWORD (se usar envio de emails)

4. Rode a aplicação backend (exemplo com uvicorn):

```powershell
cd backend/app
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Frontend (exemplo - React):

```powershell
cd frontend
npm install
npm start
```


## Screenshots

 Algumas capturas de tela do projeto (as imagens estão na pasta `FotosDoProjeto/` na 
 raiz do repositório).



## Requisitos

O projeto usa Redis. Para executar localmente, inicie o Redis com Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

Alternativa (docker-compose):
```bash
docker-compose up -d redis
```



# Autor

Desenvolvido por Eduardo L. Lucio  
GitHub: https://github.com/EduardoLLucio

Versão: 1.0.0 — 2025