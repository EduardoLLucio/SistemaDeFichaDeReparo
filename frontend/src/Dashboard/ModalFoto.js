import React, { useState, useEffect } from "react";
import api from '../services/api';

export default function ModalFoto({
    modalFotoOpen,
    setModalFotoOpen,
    fotoPreview,
    setFotoPreview,
    fotoFile,
    setFotoFile,
    atualizarFotoUrl
}) {

    const [zoom, setZoom] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        return () => {
            if (fotoPreview && fotoPreview.startsWith('blob:')) {
                try { URL.revokeObjectURL(fotoPreview); } catch (_) { }
            }
        };
    }, [fotoPreview]);

    if (!modalFotoOpen) return null;

    const handleClose = () => {
        if (uploading) return; 
        if (fotoPreview && fotoPreview.startsWith('blob:')) {
            try { URL.revokeObjectURL(fotoPreview); } catch (_) { }
        }
        setFotoPreview(null);
        setFotoFile(null);
        setError(null);
        setZoom(false);
        setModalFotoOpen(false);
    };

    const handleFileChange = (e) => {
        setError(null);
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 11 * 1024 * 1024; // 11MB

        if (!allowed.includes(file.type)) {
            setError('Tipo de arquivo não suportado. Use JPG, PNG ou WEBP.');
            return;
        }

        if (file.size > maxSize) {
            setError('Arquivo muito grande. Máximo 11MB.');
            return;
        }

        if (fotoPreview && fotoPreview.startsWith('blob:')) {
            try { URL.revokeObjectURL(fotoPreview); } catch (_) { }
        }

        setFotoFile(file);
        setFotoPreview(URL.createObjectURL(file));
    };

    const handleUpload = async () => {
        if (!fotoFile) return;
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('foto', fotoFile);
            await api.post('/upload-foto', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFotoPreview(null);
            setFotoFile(null);
            setModalFotoOpen(false);
            if (typeof atualizarFotoUrl === 'function') atualizarFotoUrl();
        } catch (e) {
            const detail = e?.response?.data?.detail;
            if (detail) setError(String(detail));
            else if (e?.request) setError('Erro de conexão. Tente novamente.');
            else setError('Erro inesperado. Tente novamente.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            className='modal-overlay'
            role="dialog"
            aria-modal="true"
            onClick={() => { if (!uploading) handleClose(); }}
        >
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>Alterar Foto de Perfil</h2>

                <input
                    type='file'
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={uploading}
                    aria-label="Selecionar foto de perfil"
                />

                {fotoPreview && (
                    <img
                        src={fotoPreview}
                        alt="Preview"
                        style={{
                            width: zoom ? 300 : 80,
                            borderRadius: '50%',
                            margin: '1rem auto',
                            cursor: 'pointer',
                            display: 'block',
                            objectFit: 'cover'
                        }}
                        onClick={() => setZoom(!zoom)}
                        title="Clique para ampliar"
                    />
                )}

                {error && <div className="msg error" role="alert">{error}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                        className="btn"
                        onClick={handleUpload}
                        disabled={uploading || !fotoFile}
                        aria-busy={uploading}
                    >
                        {uploading ? 'Enviando...' : 'Salvar Foto'}
                    </button>

                    <button
                        className="btn secondary"
                        onClick={handleClose}
                        disabled={uploading}
                    >
                        Cancelar
                    </button>
                </div>

                {zoom && (
                    <button className="btn" onClick={() => setZoom(false)} disabled={uploading} style={{ marginTop: 12 }}>
                        Fechar visualização
                    </button>
                )}
            </div>
        </div>
    );
}






