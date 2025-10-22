import React, {useEffect, useState} from "react";
import "./ModalCliente.scss";
import api from '../services/api';

export default function ModalCliente({open, onClose, onClienteAdicionado}){

    const [cliente, setCliente] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [endereco, setEndereco] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');

    const [error, setError] = useState('');
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCliente('');
        setTelefone('');
        setEmail('');
        setEndereco('');
        setNumero('');
        setBairro('');
        setError('');
        setSalvando(false);
    }, [open]);


    if (!open) return null;

    const todosPreenchidos = [cliente, telefone, endereco,numero, bairro].every(v => v.trim());

// transforme em FUNÇÕES (não booleanos)
    const validarEmail = (v) => v.trim() === '' || /\S+@\S+\.\S+/.test(v.trim());
    const validarTelefone = (v) => v.replace(/\D/g, '').length >= 10;
    const validarNome =(v) => /^[A-Za-zÀ-ú\s]+$/.test(v.trim());
    const validarBairro = (v) => /^[A-Za-zÀ-ú\s]+$/.test(v.trim());
    const validarEndereco = v => /^[\p{L}\p{M}\p{N} .,'\-\/#ºª°]+$/u.test(v.trim());
    const validarNumero = (v) => /^[0-9]+$/.test(v.trim());
    



    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!todosPreenchidos) return setError('Preencha todos os campos obrigatórios.');

        // chame as funções corretamente
        const telefoneNorm = (telefone || '').trim().replace(/\D/g, '');
        if (telefoneNorm.length < 10) return setError('Por favor, insira um telefone válido.');

        if (email && !validarEmail(email)) return setError('Por favor, insira um email válido.');
        if (!validarNome(cliente)) return setError('Por favor, insira um nome válido (apenas letras e espaços).');
        if (!validarBairro(bairro)) return setError('Por favor, insira um bairro válido (apenas letras e espaços).');
        if (!validarEndereco(endereco)) return setError('Por favor, insira um endereço válido.');
        if (!validarNumero(numero)) return setError('Por favor, insira um número válido (apenas dígitos).');
        
        setError('');
        setSalvando(true);
        try {
            const payload = {
                nome: cliente.trim(),
                telefone: telefoneNorm,
                endereco: endereco.trim(),
                numero: numero.trim(),
                bairro: bairro.trim()
            };

            if (email.trim()) payload.email = email.trim();

            const { data } = await api.post('/clientes', payload);

            const novo = { ...data, nome: data?.nome ?? data?.cliente ?? payload.nome };

            onClienteAdicionado?.(novo);
            try { window.dispatchEvent(new Event('app:refresh_data')); } catch (_) {}
            onClose?.();
        } catch (e){
            setError('Erro ao salvar o cliente. Tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    const fecharOverlay = () => {
        if (!salvando) onClose?.();
    };

    const clearErr = (setter) => (e) => { setter(e.target.value); if (error) setError(''); };

    return(
        <div className="modal-overlay" role="dialog" aria-modal='true'>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Novo Cliente</h2>
                <form onSubmit={handleSubmit}>
                    <div className="field-autocomplete">

                        <label>Cliente</label>
                        <input type="text"
                         placeholder="Nome do cliente" 
                         value={cliente} 
                         onChange={clearErr(setCliente)} autoComplete="name" required
                        />

                        <label>Telefone</label>
                        <input type="text" placeholder="Telefone" value={telefone} onChange={clearErr(setTelefone)}
                        inputMode="tel"
                        autoComplete="tel"
                         required
                        />

                        <label>Email (opcional)</label>
                        <input type="email" placeholder="Email (opcional)" value={email} onChange={clearErr(setEmail)}
                        autoComplete="email"
                        />
                         
                        

                        <label>Endereço</label>
                        <input type="text" placeholder="Endereço" value={endereco} onChange={clearErr(setEndereco)} 
                        autoComplete="street-address"
                        required />

                        <label>Número</label>
                        <input type="text" placeholder="Número" value={numero} onChange={clearErr(setNumero)}
                        inputMode="numeric"
                        pattern="[0-9]*" 
                        required />

                        <label>Bairro</label>
                        <input type="text" placeholder="Bairro" value={bairro} onChange={clearErr(setBairro)}
                        autoComplete="address-level2"
                        required />

                        {error && <div className="msg error">{error}</div>}

                        <div className="modal-actions">

                            <button type="button" className="btn secondary" onClick={() => onClose?.()} >
                                Cancelar
                            </button>


                            <button
                              type="submit"
                              className="btn primary"
                              disabled={salvando || !todosPreenchidos || !validarTelefone(telefone) || !validarEmail(email)}
                            >
                                {salvando ? "Salvando..." : "Salvar"}

                            </button>

                        </div>    
                    </div>
                </form>
        </div>
        </div>
    );
}

    





    



