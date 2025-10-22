import React, {useEffect, useState} from "react";
import './ModalEdicao.scss';
import api from "../services/api";

export default function ModalEdicaoCliente({ open, clienteId, onClose, onSaved }) {

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [cliente, setCliente] = useState(null);

    const [fichas, setFichas] = useState([]);
    const [form, setForm] = useState({
        nome: '',
        telefone: '',
        email: '',
        endereco: '',
        numero: '',
        bairro: '',
    });

    useEffect(() => {
        if (!open || !clienteId) return;
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const { data } = await api.get(`/clientes/${clienteId}`);
                if (cancelled) return;
                const payloadCliente = data.cliente || data || {};
                const payloadFichas = Array.isArray(data.fichas) ? data.fichas : [];
                setCliente(payloadCliente);
                setFichas(payloadFichas);
                setForm({
                    nome: payloadCliente.nome || '',
                    telefone: payloadCliente.telefone || '',
                    email: payloadCliente.email || '',
                    endereco: payloadCliente.endereco || '',
                    numero: payloadCliente.numero || '',
                    bairro: payloadCliente.bairro || '',
                });
            } catch (error) {
                console.error("Erro ao carregar cliente:", error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, clienteId]);

    if (!open) return null;

    const change  = (k) => (e) => setForm((s) => ({...s, [k]: e.target.value}));

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {...form};

            const allowEmpty = ['completamento'];
            Object.keys(payload).forEach(k => {
                if (payload[k] === '' && !allowEmpty.includes(k)) {
                    delete payload[k];
                }
                if (payload[k] === null || payload[k] === undefined) {
                    delete payload[k];
                }
            });

            const { data } = await api.put(`/clientes/${clienteId}`, payload);
            onSaved?.(data);
            onClose?.();
        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            alert("Erro ao salvar cliente. Verifique o console para mais detalhes.");
        } finally {
          setSaving(false);
        }
    };

    return (
        <div className="modal-overlay modal-cliente">
            <div className="modal-content modal-cliente__content" onClick={(e) => e.stopPropagation()}>
                 <h2 className="modal-title">Cliente #{clienteId}</h2>

                {loading ? (
                    <div>Carregando...</div>
                ) : (
                    <form onSubmit={handleSave} className="modal-form">
                        <div className="modal-grid-row">
                            <div className="modal-left">
                                <div className="form-grid">

                                    <label>
                                        Nome:
                                        <input value={form.nome} onChange={change('nome')} />
                                    </label>

                                    <label>
                                        Telefone:
                                        <input value={form.telefone} onChange={change('telefone')} />
                                    </label>

                                    <label>
                                        Email:
                                        <input type="email" value={form.email} onChange={change('email')} />
                                    </label>

                                    <label>
                                         Endereço:
                                        <input value={form.endereco} onChange={change('endereco')} />
                                    </label>

                                    <label>
                                        Número:
                                        <input value={form.numero} onChange={change('numero')} />
                                    </label>

                                    <label>
                                        Bairro:
                                        <input value={form.bairro} onChange={change('bairro')} />
                                    </label>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className='btn secondary' onClick={onClose} disabled={saving}>Cancelar</button>
                                    <button type="submit" className='btn' style={{marginLeft: 8}} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                                </div>
                            </div>

                            <aside className="modal-right">
                                <div style={{ marginBottom: 8 }}>
                                    <strong>Dados atuais:</strong>
                                </div>

                                <div className="dados-atuais">
                                    <div><strong>Nome:</strong> {cliente?.nome || '-'}</div>
                                    <div><strong>Telefone:</strong> {cliente?.telefone || '-'}</div>
                                    <div><strong>Email:</strong> {cliente?.email || '-'}</div>
                                    <div><strong>Endereço:</strong> {cliente?.endereco ? `${cliente.endereco}${cliente.numero ? ', ' + cliente.numero : ''}` : '-'}</div>
                                    <div><strong>Bairro:</strong> {cliente?.bairro || '-'}</div>
                                </div>
                            </aside>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}