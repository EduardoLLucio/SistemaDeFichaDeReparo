import React, { useEffect, useState } from "react";
import "./Logs.scss";
import api from '../services/api';

const PAGE_SIZE = 20;

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true);
            setError("");
            try {
                const params = { page, page_size: PAGE_SIZE };
                const { data } = await api.get('/logs', { params, signal: controller.signal });

                const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
                const total = data?.total;

                setLogs((prev) => (page === 1 ? rows : [...prev, ...rows]));
                setHasMore(
                    typeof total === 'number'
                        ? page * PAGE_SIZE < total
                        : rows.length === PAGE_SIZE
                );

            } catch (e) {
                if (!controller.signal.aborted) setError("Erro ao carregar logs.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        load();
        return () => { controller.abort(); };
    }, [page, refresh]);

    const recarregar = () => {
        setLogs([]);
        setHasMore(true);
        setError("");
        setPage(1);
        setRefresh((r) => r + 1);
    };
    const carregarMais = () => {
        if (hasMore && !loading) {
            setPage((p) => p + 1);
        }
    };
    const fmtDate = (v) => {
        const d = v || "";
        const date =
            typeof d === "string" || typeof d === "number" ? new Date(d) : d;
        if (!date || isNaN(date.getTime())) return "-";
        return date.toLocaleString();
    };

    const nivel = (log) => (log?.nivel || log?.level || log?.severity || "info").toLowerCase();

    return (
        
        <div className="logs-page">           
            <div className="header-actions">
                <button className="btn primary" onClick={recarregar} disabled={loading}>
                    {loading ? "Carregando..." : "Recarregar"}
                </button>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="logs-table-wrap">
                <table className="logs-toolbar">
                    <thead>
                        <tr>
                            <th>Data/Hora</th>
                            <th>Nível</th>
                            <th>Mensagem</th>
                            <th>Origem</th>
                            <th>Usuário</th>

                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 && !loading && !error ? (
                            <tr>
                                <td colSpan="5" className="empty">
                                    Nenhum log encontrado.
                                </td> 
                            </tr>
                          ) : (
                            logs.map((l, i) => (
                                <tr key={l.id ?? `${l.data ?? l.timestamp ?? i}`}>
                                    <td>{fmtDate(l.data ?? l.timestamp ?? l.created_at)}</td>
                                    <td>
                                        <span className={`level ${nivel(l)}`}>{nivel(l)}</span>
                                    </td>
                                    <td className="col-msg">{l.mensagem ?? l.detalhe ?? l.acao ?? "-"}</td>

                                    <td>{l.origem ?? l.source ?? "-"}</td>
                                    <td>{l.usuario ?? l.user ?? l.admin_id ?? "-"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
            

                <div className="logs-footer">
                    <button className='btn' onClick={carregarMais} disabled={!hasMore || loading}>
                        {loading ? 'Carregando...' : hasMore ? 'Carregar mais' : 'Fim dos dados'}
                    </button>
                </div>
            </div>
    );
}