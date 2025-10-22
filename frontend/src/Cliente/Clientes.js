import React, {useEffect, useMemo, useState, useRef} from "react";
import { useNavigate } from "react-router-dom";
import "./Clientes.scss";
import api from '../services/api';
import ModalCliente from './ModalCliente';
import ModalEditarCliente from './ModalEdicaoCliente.js';


const PAGE_SIZE = 12;
const MIN_QUERY = 2;

export default function Clientes({clientesProp = []}) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const [editarClienteId, setEditarClienteId] = useState(null);

  const abrirModal = () => setShowModal(true);
  const fecharModal = () => setShowModal(false);

  const [items, setItems] = useState(clientesProp);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState('');
  const filtros = useMemo(() => ({ q: q.trim() }), [q]);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const abrirFicha = (id) => { setEditarClienteId(id); };
  const editarFicha = (id) => { setEditarClienteId(id); };

  useEffect(() => {
    const aborter = new AbortController();
    async function carregar() {
      if (!hasMore && page > 1) return;
      if (loading) return;
      const termo = filtros.q;
      if (termo.length > 0 && termo.length < MIN_QUERY) return;

      setLoading(true); 
      setError("");

      try {
        const params = { page, page_size: PAGE_SIZE };
        if (termo.length >= MIN_QUERY) params.q = termo;
        const resp = await api.get('/clientes', { params, signal: aborter.signal });
        const payload = Array.isArray(resp.data.items) ? resp.data.items : [];
        const total = resp.data.total;
        setItems(prev => {
          const nova = page === 1 ? payload : [...prev, ...payload];
          if (typeof total === 'number') setHasMore(nova.length < total);
          else setHasMore(payload.length === PAGE_SIZE);
          return nova;
        });
      } catch (e) {
        if (!aborter.signal.aborted) setError("Erro ao carregar clientes");
      } finally {
        if (!aborter.signal.aborted) setLoading(false);
      }
    }
    carregar();
    return () => { aborter.abort(); };
  }, [page, filtros]);

  const termoCurto = filtros.q.length > 0 && filtros.q.length < MIN_QUERY;
  const carregarMais = () => { if (!loading && hasMore) setPage(p => p + 1); };
  const limparBusca = () => {
    if (q === '') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQ(''); setPage(1); setHasMore(true); setError('');
    requestAnimationFrame(() => { inputRef.current?.focus(); });
  };
  const onClienteAdicionado = (novo) => {
    fecharModal();
    
    // mostra imediatamente sem reload completo

    if (novo) {
      setItems(prev => [novo, ...prev]);
    }
    setPage(1);
    setHasMore(true);
    setError('');
    requestAnimationFrame(() => { inputRef.current?.focus(); });
    try { window.dispatchEvent(new Event('app:refresh_data')); } catch (_) {}
  };


  const onClienteSalvo = (atualizado) => {
    if (atualizado && atualizado.id) {
      setItems(prev => prev.map(it =>(it.id === atualizado.id ? {...it, ...atualizado} : it)));
    } else {
      setItems([]);
      setPage(1);
    }
    setEditarClienteId(null);

  }

  

  const formatPhone = (tel = '') => {
    const d = (tel || '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return tel || '-';
  };

  return (
    <div className='clientes-page'>
      <div className='clientes-toolbar'>
        <div className="toolbar-left">
          <input
            ref={inputRef}
            className="inp"
            placeholder="Buscar por Nome..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className='btn ghost' onClick={limparBusca} disabled={q === ''}>Limpar</button>
        </div>

        <div className='header-actions'>
          <button className='btn primary' onClick={abrirModal}>Novo Cliente</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="clientes-grid">
        {!termoCurto && items.map(c => {
          const enderecoLabel = (() => {
            const parts = [];
            if (c.endereco) parts.push(c.endereco);
            if (c.numero) parts.push(c.numero);
            return parts.length ? parts.join(', ') : null;
          })();

          return (
            <div key={c.id} className="cliente-card" role='button' tabIndex={0} onClick={() => {
              setEditarClienteId(c.id);
            }}>
              <div className="cliente-top">
                <strong className="cliente-name">{c.nome}</strong>
              </div>

              <div className="cliente-body">
                <span className="label">Telefone</span>
                <span className="value">{c.telefone ? formatPhone(c.telefone) : '-'}</span>

                <span className="label">Email</span>
                <span className="value">{c.email || '-'}</span>

                <span className="label">Endereço</span>
                <span className="value">{enderecoLabel || '-'}</span>

                <span className="label">Bairro</span>
                <span className="value">{c.bairro || '-'}</span>

                <span className="label">Número</span>
                <span className="value">{c.numero || '-'}</span>

                <span className="label" aria-hidden="true"></span>
                <span className="value" aria-hidden="true"></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className='footer-actions' style={{ marginTop:12 }}>
        <button className='btn' onClick={carregarMais} disabled={!hasMore || loading}>
          {loading ? 'Carregando...' : hasMore ? 'Carregar mais' : 'Fim dos dados'}
        </button>
      </div>

      <ModalCliente open={showModal} onClose={fecharModal} onClienteAdicionado={onClienteAdicionado} />
      {editarClienteId && (
        <ModalEditarCliente
        open={!!editarClienteId}
        clienteId={editarClienteId}
        onClose={() => setEditarClienteId(null)}
        onSaved={onClienteSalvo}
      />
      )}
    </div>
  );
}
