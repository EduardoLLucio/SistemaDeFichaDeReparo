import os
import io
import uuid
import shutil
import base64
import logging
from typing import Dict
from jinja2 import Environment, FileSystemLoader, select_autoescape
import pdfkit
import qrcode
from PIL import Image


logger =  logging.getLogger(__name__)


TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), 'templates')
env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)

ALLOW_LOCAL_FILE_ACCESS = os.getenv('PDF_ALLOW_LOCAL_FILE_ACCESS', 'true').lower() in ('1', 'true', 'yes')

def render_ficha_html(context: Dict) -> str:
    tpl = env.get_template('ficha.html')
    return tpl.render(**context)

def _generate_qr_data_uri(text: str, size: int = 200) -> str:
    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white').convert('RGB')
    img = img.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f"data:image/png;base64,{b64}"


def _sanitize_context(context: Dict, max_field_len: int = 8000) -> Dict:
    out = dict(context or {})
    ficha = dict(out.get("ficha", {}) or {})
    for k, v in ficha.items():
        if isinstance(v, str):
            ficha[k] = v[:max_field_len]
    out['ficha'] = ficha
    return out

def ficha_to_pdf_bytes(context: Dict, wkhtmltopdf_path: str = None) -> bytes:
    
    wk = wkhtmltopdf_path or os.getenv('WKHTMLTOPDF_PATH') or shutil.which('wkhtmltopdf')
    if not wk:
        raise RuntimeError("wkhtmltopdf não encontrado. Defina WKHTMLTOPDF_PATH ou instale wkhtmltopdf no PATH.")
    if not os.path.isfile(wk):
        wk = shutil.which(wk) or wk
    if not os.path.isfile(wk):
        raise RuntimeError(f"wkhtmltopdf não encontrado no caminho especificado: {wk}")

    context = _sanitize_context(context, max_field_len=int(os.getenv("PDF_MAX_FIELD_LEN", "8000")))


    try:
        codigo = context.get('ficha', {}).get('codigo_rastreio', '') or ""
        base_url = context.get('base_url', os.getenv('BASE_URL', 'http://localhost:3000')).rstrip('/')
        rastreio_url = f"{base_url}/rastreio/{codigo}"
        context = dict(context)
        context['ficha'] = dict(context.get('ficha', {}))
        # chave usada no template é 'qr_data_uri'
        context['ficha']['qr_data_uri'] = _generate_qr_data_uri(rastreio_url, size=int(os.getenv('QR_CODE_SIZE', '220')))
    except Exception:
        # não falhar a geração do PDF por causa do QR
        logger.exception("Erro ao gerar QR code para PDF")
        context.setdefault('ficha', {})['qr_data_uri'] = None

    html = render_ficha_html(context)
    options = {
        "dpi": "300",
        "page-size": "A4",
        "margin-top": "8mm",
        "margin-bottom": "8mm",
        "margin-left": "8mm",
        "margin-right": "8mm",
        "no-outline": None,
        "quiet": None,
        "disable-javascript": None,
        "no-stop-slow-scripts": None,
    }
    
    if ALLOW_LOCAL_FILE_ACCESS:
        options["enable-local-file-access"] = None
    
    try:
        config = pdfkit.configuration(wkhtmltopdf=wk)
        pdf_bytes = pdfkit.from_string(html, False, options=options, configuration=config)
        if not pdf_bytes:
            raise RuntimeError("wkhtmltopdf retornou resultado vazio. Verifique instalação/WKHTMLTOPDF_PATH.")
        return pdf_bytes
    except Exception:
        logger.exception("Erro ao gerar PDF com wkhtmltopdf")
        raise RuntimeError("Erro ao gerar PDF. Verifique logs do servidor para mais detalhes.")
       