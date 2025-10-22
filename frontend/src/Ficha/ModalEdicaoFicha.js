import {useEffect, useState} from "react";
import './ModalEdicaoFicha.scss';
import api from "../services/api";

export default function ModalEdicaoFicha({ open, fichaId, onClose, onSaved }) {

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [ficha, setFicha] = useState(null);
    const [cliente, setCliente] = useState(null);
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        status: '',
        observacao_privada: '',
        observacao_publica: '',
        valor: '',
        previsao_entrega: '',
        descricao: '',
        defeito: '',
        acessorios: '',
        categoria: '',
        marca: '',
        modelo: '',
        serial: '',
        codigo_rastreio: '',
    });

    const editableFields = [
        'status',
        'previsao_entrega',
        'valor',
        'observacao_publica',
        'observacao_privada',
        'defeito',
        'acessorios'
    ];

    const buildPayload = (src) => {
        const p = {};
        editableFields.forEach(k => {
            if (src[k] !== undefined && src[k] !== null && String(src[k]).trim() !== '') {
                p[k] = src[k];
            }
        });
        if (p.valor !== undefined) {
            const v = parseFloat(String(p.valor).toString().replace(',', '.'));
            if (Number.isNaN(v) || v < 0) throw new Error('Valor inválido');
            p.valor = v;
        }
        return p;
    };

    const formatPrevisao = (p) => {
       if (!p) return '-';
       const d = Date.parse(p);
       if (!Number.isNaN(d)) return new Date(d).toLocaleDateString();
       return String(p);
};

    useEffect(() => {
        if (!open || !fichaId) return;
        const controller = new AbortController();
        setLoading(true);
        (async () => {
            try {
                const { data } = await api.get(`/fichas/${fichaId}/detail`, { signal: controller.signal });
                if (controller.signal.aborted) return;
                setFicha(data.ficha);
                setCliente(data.cliente);
                setLogs(data.logs || []);
                setForm({
                    status: data.ficha.status || '',
                    observacao_privada: data.ficha.observacao_privada || '',
                    observacao_publica: data.ficha.observacao_publica || '',
                    valor: data.ficha.valor ?? '',
                    previsao_entrega: data.ficha.previsao_entrega || '',
                    descricao: data.ficha.descricao || '',
                    defeito: data.ficha.defeito || '',
                    acessorios: data.ficha.acessorios || '',
                    produtos: data.ficha.produtos || '',
                    marca: data.ficha.marca || '',
                    modelo: data.ficha.modelo || '',
                    serial: data.ficha.serial || '',
                    codigo_rastreio: data.ficha.codigo_rastreio || '',
                });
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error("Erro ao carregar ficha:", error);
                    setError('Erro ao carregar ficha. Tente novamente.');
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        })();

        return () => { controller.abort(); };
    }, [open, fichaId]);

    if (!open) return null;

    const change  = (k) => (e) => setForm((s) => ({...s, [k]: e.target.value}));

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = buildPayload(form);

            if (Object.keys(payload).length === 0) {
                setSaving(false);
                return onClose?.();
            }
            const { data } = await api.put(`/fichas/${fichaId}`, payload);
            onSaved?.(data);
            onClose?.();
        } catch (error) {
            console.error("Erro ao salvar ficha:", error);
            setError(error?.response?.data?.message || "Erro ao salvar ficha. Verifique o console para mais detalhes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay modal-ficha">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                 <h2 className="modal-title">Ficha #{fichaId} - {cliente?.nome || '-'}</h2>
                {loading ? <div>Carregando...</div> : (
                    <form onSubmit={handleSave} className="modal-form">
                        <div className="modal-grid-row">
                            <div className="modal-left">
                                <div className="form-grid">

                                    <label>
                                        Status:
                                        <select value={form.status} onChange={change('status')}>
                                            <option value="">Selecione um status</option>
                                            <option value="ABERTA">Aberta</option>
                                            <option value="EM_ANALISE">Em Análise</option>
                                            <option value="AGUARDANDO_PECA">Aguardando peça</option>
                                            <option value="EM_REPARO">Em Reparo</option>
                                            <option value="FINALIZADA">Finalizada</option>
                                            <option value="ENTREGUE">Entregue</option>
                                            <option value="CANCELADA">Cancelada</option>
                                        </select>
                                    </label>

                                   <label>
                                        Previsão de Entrega:
                                        <input type="text" placeholder="ex: 2 semanas, 1 mês" value={form.previsao_entrega} onChange={change('previsao_entrega')} />
                                    </label>
            
                                    <label>
                                         Valor (R$):
                                        <input type="number" step="0.01" value={form.valor} onChange={change('valor')} />
                                    </label>

                                    <label>
                                        Acessórios:
                                        <input value={form.acessorios} onChange={change('acessorios')} />
                                    </label>

                                    <label>
                                        Observação pública:
                                        <textarea value={form.observacao_publica} onChange={change('observacao_publica')} rows={2} />
                                    </label>

                                    <label className="col-span-2">
                                        Observação privada:
                                        <textarea value={form.observacao_privada} onChange={change('observacao_privada')} rows={3} />
                                    </label>
                                </div>
                            </div>

                            <aside className="modal-right full-data">
                                <div className="right-section">
                                    <strong>Dados do Cliente</strong>
                                    <div className="dados-atuais cliente">
                                        <div><span className="k">Nome:</span> <span className="v">{cliente?.nome || '-'}</span></div>
                                        <div><span className="k">Telefone:</span> <span className="v">{cliente?.telefone || '-'}</span></div>
                                        <div><span className="k">Email:</span> <span className="v">{cliente?.email || '-'}</span></div>
                                        <div><span className="k">Endereço:</span> <span className="v">{cliente?.endereco ? `${cliente.endereco}${cliente.numero ? ', ' + cliente.numero : ''}` : '-'}</span></div>
                                        <div><span className="k">Bairro:</span> <span className="v">{cliente?.bairro || '-'}</span></div>
                                    </div>
                                </div>

                                <div className="right-section">
                                    <strong>Dados da Ficha</strong>
                                    <div className="dados-ficha">
                                        <div className="ficha-row"><span className="ficha-label">Produto:</span><span className="ficha-val">{ficha?.categoria || '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Marca:</span><span className="ficha-val">{ficha?.marca || '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Modelo:</span><span className="ficha-val">{ficha?.modelo || '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Serial:</span><span className="ficha-val">{ficha?.serial || '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Rastreio:</span><span className="ficha-val">{ficha?.codigo_rastreio || '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Defeito:</span><span className="ficha-val">{ficha?.defeito || '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Acessórios:</span><span className="ficha-val">{ficha?.acessorios || '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Valor:</span><span className="ficha-val">{ficha?.valor ?? '-'}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Previsão:</span><span className="ficha-val">{formatPrevisao(ficha?.previsao_entrega)}</span></div>
                                        <div className="ficha-row"><span className="ficha-label">Descrição:</span><span className="ficha-val">{ficha?.descricao || '-'}</span></div>
                                    </div>
                                </div>

                                 <div className="right-section">
                                    <strong>Histórico</strong>
                                    <ul className="history-list">
                                        {logs.length === 0 ? <li className="empty">Nenhum registro</li> : logs.map(l => (
                                            <li key={l.id || `${l.data}-${l.status}`} className="history-item">
                                                <div className="history-date">{new Date(l.data || l.created_at || l.data_hora).toLocaleString()}</div>
                                                <div className="history-text">{l.status}{l.descricao ? `: ${l.descricao}` : ''}</div>
                                            </li>
                                        ))}
                                        
                                    </ul>
                                    <div className="modal-footer">
                                        <button type="button" className='btn secondary' onClick={onClose} disabled={saving}>Cancelar</button>
                                        <button type="submit" className='btn' style={{marginLeft: 8}} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                                    </div>
                                </div>
                            </aside>
                        </div>                       
                    </form>
                )}
                {error && <div className="msg error">{error}</div>}
            </div>
        </div>
    );
}