import React, { useEffect, useMemo, useState, useRef } from 'react';
import api from '../services/api.js';
import ModalFicha from './ModalFicha';
import './Ficha.scss';
import ModalEditarFicha from './ModalEdicaoFicha.js';


const PAGE_SIZE = 12;



const Fichas = ({fichas: fichasProp = [] }) => {


    const [showModal, setShowModal] = useState(false);
    const [editarFichaId, setEditarFichaId] = useState(null);


    const abrirModal = () => setShowModal(true);
    const fecharModal = () => setShowModal(false);

    //dados + paginação
    const [items, setItems] = useState(fichasProp);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const mountedRef = useRef(true);


    //filtros
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [dataIni, setDataIni] = useState('');
    const [dataFim, setDataFim] = useState('');

    const filtros = useMemo(
        () => ({q, status, data_ini: dataIni, data_fim: dataFim}),
        [q, status, dataIni, dataFim]
    );

    // reset ao mudar filtros
    useEffect(() => {
        mountedRef.current = true;
        const filtro = localStorage.getItem('filtro_cliente_nome');
        if (filtro) {
            setQ(filtro);
            localStorage.removeItem('filtro_cliente_nome');
            setItems([]);
            setPage(1);
            setHasMore(true);
    }
    return () => { mountedRef.current = false; };
    }, []);



    //busca
    useEffect(() => {
        let cancel = false;
        const controller = new AbortController();
        async function load() {
            if (!hasMore && page > 1) return;
            setLoading(true);
            setError('');
            try {
                const params = {page, page_size: PAGE_SIZE};
                if (filtros.q) params.q = filtros.q;
                if (filtros.status) params.status = filtros.status;
                if (filtros.data_ini) params.data_ini = filtros.data_ini;
                if (filtros.data_fim) params.data_fim = filtros.data_fim;

                const { data } = await api.get('/fichas', { params, signal: controller.signal  });
                const rows = Array.isArray(data?.items)? data.items : Array.isArray(data) ? data : [];
                const total = data?.total;

                if (!cancel && mountedRef.current) {
                    setItems(prev => (page === 1 ? rows : [...prev, ...rows]));
                    setHasMore(typeof total === 'number' ? page * PAGE_SIZE < total : rows.length === PAGE_SIZE);
                }
            } catch (error){
                if (!cancel && !controller.signal.aborted) {
                    setError('Erro ao carregar dados');
                    console.error('Erro ao carregar fichas', error);
                }
            } finally {
                if (!cancel && mountedRef.current) setLoading(false);
            }
        }
        load();
        return () => {
         cancel = true;
         controller.abort();
        };
    }, [page, filtros, reload]);

    const carregarMais = () => {
        if (!loading && hasMore) setPage((p) => p + 1);
    };


    //acoes

    const abrirFicha = (id) => { setEditarFichaId(id); };
    const editarFicha = (id) => { setEditarFichaId(id); };


    const imprimirFicha = async (id) => {

        try {

            const resp = await api.get(`/fichas/${id}/pdf`, { responseType: 'blob', timeout: 20000 });
            const blob = new Blob([resp.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');

            setTimeout(() => { try {
                window.URL.revokeObjectURL(url);
            } catch (_) {} }, 15000);
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            setError('Erro ao gerar PDF. Tente novamente.');

        }
    };

    const onFichaAdicionada = (nova) => {
         if (nova) {
            setItems(prev => [nova, ...prev]);
        }
        setPage(1);
        setHasMore(true);
        setReload(r => r + 1);
        try { window.dispatchEvent(new Event('app:refresh_data')); } catch (_) {}
 
        try {
             const id = nova?.id || (typeof nova === 'number' ? nova : null);
            if (id) setTimeout(() => imprimirFicha(id), 300);
        } catch (error) {
            console.error('Erro ao imprimir nova ficha:', error);
        }
     };

    const onFichaSalva = (atualizada) => {
        setEditarFichaId(null);
        
        if (atualizada && atualizada.id) {
            setItems(prev => prev.map(i => (i.id === atualizada.id ? { ...i, ...atualizada } : i)));
        } else {
            
            setItems([]);
            setPage(1);
            setHasMore(true);
        }
        setReload(r => r + 1);
        try { window.dispatchEvent(new Event('app:refresh_data')); } catch (_) {}
    };

    return (
        <>
        <div className='header-actions'>
            <button className='btn primary' onClick={abrirModal}>Nova Ficha</button>
        </div>
        <div className='fichas-page'>
            <div className='fichas-toolbar'>
                <input className='inp' type='text' placeholder='Buscar por cliente, id, aparelho...' value={q} onChange={(e) => setQ(e.target.value)} />

                <select className='inp' value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value=''>Todos os status</option>
                    <option value='ABERTA'>Aberta</option>
                    <option value='EM_ANALISE'>Em análise</option>
                    <option value='AGUARDANDO_PECA'>Aguardando peça</option>
                    <option value='EM_REPARO'>Em reparo</option>
                    <option value='FINALIZADA'>Finalizada</option>
                    <option value='ENTREGUE'>Entregue</option>
                    <option value='CANCELADA'>Cancelada</option>
                </select>
                <input className='inp' type='date' value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
                <span>até</span>
                <input className='inp' type='date' value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                <button className='btn' onClick={() => setPage(1)} disabled={loading}>Filtrar</button>
                <button className='btn ghost' onClick={() => { setQ(''); setStatus(''); setDataIni(''); setDataFim(''); setPage(1); setItems([]); }} disabled={loading}>Limpar</button>

            </div>

            {error && <div className='error'>{error}</div>}

            <div className='fichas-grid'>
                {items.map((f, idx) => {
                    const displayIndex = ((page || 1) - 1) * PAGE_SIZE + idx + 1;
                    return(
                    <div key={f.id} className='ficha-card' role='button' tabIndex={0} onClick={() => abrirFicha(f.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && abrirFicha(f.id)}>
                        <div className='ficha-top'>
                            <div className='ficha-top-left'>
                                <span className='ficha-id'>#{displayIndex}</span>
                                {f.status && (
                                    <span className={`pill ${String(f.status).toLowerCase()}`}>{String(f.status).replace(/_/g,' ')}</span>
                                )}
                            </div>
                            <div className='ficha-actions'>
                                <button className='icon-btn' title='Editar' onClick={(e) => { e.stopPropagation(); editarFicha(f.id); }}>✎</button>
                                <button className='icon-btn' title='Imprimir' onClick={(e) => { e.stopPropagation(); imprimirFicha(f.id); }}>🖨</button>
                            </div>
                        </div>

                <div className='ficha-cliente' title={f.cliente}>{f.cliente || '—'}</div>

                <div className='ficha-body'>
                    <div className='campo'>
                        <span className='label'>Abertura</span>
                        <span className='valor'>{f.criado_em ? new Date(f.criado_em).toLocaleDateString('pt-BR') : '—'}</span>
                    </div>
                    {f.cliente && (
                        <div className='campo'>
                            <span className='label'>Cliente</span>
                            <span className='valor' title={f.cliente}>{f.cliente}</span>
                        </div>
                    )}
                    {(f.aparelho || f.equipamento) && (
                        <div className='campo'>
                            <span className='label'>Aparelho</span>
                            <span className='valor' title={f.aparelho || f.equipamento}>{f.aparelho || f.equipamento}</span>
                        </div>
                    )}
                    {(f.marca || f.modelo) && (
                        <div className='campo'>
                            <span className='label'>Marca</span>
                            <span className='valor' title={f.marca || f.modelo}>{f.marca || f.modelo}</span>
                        </div>
                    )}
                    {(f.numero_serie || f.serie) && (
                        <div className='campo'>
                            <span className='label'>Número de Série</span>
                            <span className='valor'>{f.numero_serie || f.serie}</span>
                        </div>
                    )}
                    {f.defeito && (
                        <div className='campo'>
                            <span className='label'>Defeito</span>
                            <span className='valor' title={f.defeito}>{f.defeito}</span>
                        </div>
                    )}
                    {f.acessorios && (
                        <div className='campo'>
                            <span className='label'>Acessórios</span>
                            <span className='valor' title={f.acessorios}>{f.acessorios}</span>
                        </div>
                    )}
                    {f.previsao_entrega && (
                        <div className='campo'>
                            <span className='label'>Previsão de Entrega</span>
                            <span className='valor'>
                                {new Date(f.previsao_entrega).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    )}
                    {f.valor != null && (
                        <div className='campo'>
                            <span className='label'>Valor</span>
                            <span className='valor'>R$ {Number(f.valor).toLocaleString('pt-BR')}</span>
                        </div>
                    )}
                </div>
                {f.obs && <div className='nota' title={f.obs}>{f.obs}</div>}

                {f.atualizado_em && <div className='ficha-foot'><span className='muted'>Atualizado</span><span>{new Date(f.atualizado_em).toLocaleDateString('pt-BR')}</span></div>}
            </div>
            );
        })}
        </div>

        <div className='fichas-footer'>
            <button className='btn' onClick={carregarMais} disabled={!hasMore || loading}>
                {loading ? 'Carregando...' : hasMore ? 'Carregar mais' : 'Fim dos dados'}
            </button>
        </div>
        </div>

        {showModal && (<ModalFicha open={showModal} onClose={fecharModal} onFichaAdicionada={onFichaAdicionada} />)}
        {editarFichaId && (<ModalEditarFicha open={!!editarFichaId} fichaId={editarFichaId} onClose={() => setEditarFichaId(null)} onSaved={onFichaSalva} />)}
        </>
    );
};

export default Fichas;