import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import './Rastreio.scss';
import { useParams } from 'react-router-dom';

export default function Rastreio() {
  const [codigo, setCodigo] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const params = useParams();

  const buscar = useCallback(async (eventOrCode) => {
    if (eventOrCode && typeof eventOrCode.preventDefault === 'function')  {
      eventOrCode.preventDefault();
    }

    const q = (typeof eventOrCode === 'string' ? eventOrCode : codigo || '').trim();
    if (!q) { setErr('Informe o código'); setData(null); return; }
    
    setErr(''); setData(null); setLoading(true);

    try {
      const { data: res } = await api.get(`/rastreio/${encodeURIComponent(q)}`);
      setData(res);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail) setErr(detail);
      else if (e?.message) setErr('Erro de conexao:  ' + e.message);
      else setErr('Código não encontrado');
    } finally {
      setLoading(false);
    }
  }, [codigo]);

  useEffect(() => {
    const p = params?.codigo;
    if (p && p.trim()) {
      setCodigo(p);
      buscar(p);
    }
  }, [params?.codigo, buscar]);

  return (
    <div className="rastreio">
        <h2>Rastreio</h2>

        <div className='rastreio-row'>
            <input
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Insira o código de rastreio"
                aria-label="Código de rastreio"
                disabled={loading}
            />
            <button className='primary' type='button' onClick={buscar} disabled={loading || !(codigo || '').trim()} aria-busy={loading}>

                {loading ? 'Buscando...' : 'Buscar'}
            </button>
        </div>

        {err && <div className="error" role='alert'>{err}</div>}

        {data && (
            <div className="result" aria-live='polite'>
                <div><strong>Status:</strong> <span>{data.status || '-'}</span></div>
                <div><strong>Defeito:</strong> <span>{data.defeito || '-'}</span></div>
                <div><strong>Previsão de entrega:</strong> <span>{data.previsao_entrega || '-'}</span></div>
                <div><strong>Observações:</strong> <span>{data.observacao_publica || '-'}</span></div>
                <div><strong>Cliente:</strong> <span>{data.cliente_nome || '-'}</span></div>
            </div>
        )}
    </div>
    );
}