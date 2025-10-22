import React, {useEffect, useState, useRef} from "react";
import "./ModalFicha.scss"; 
import api from '../services/api';
import { FaMagnifyingGlass } from "react-icons/fa6";


export default function ModalFicha({open, onClose, onFichaAdicionada}){
  const [cliente, setCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [sugestoes, setSugestoes] = useState([]);



  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');



  const [aparelho, setAparelho] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [serial, setSerial] = useState('');
  const [defeito, setDefeito] = useState('');
  const [acessorios, setAcessorios] = useState('');
  const [previsao, setPrevisao] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const inputRef = useRef(null);


  useEffect(() => {
    if (!open) return;
    setCliente('');
    setClienteSelecionado(null);
    setSugestoes([]);
    setTelefone('');
    setEmail('');
    setEndereco('');
    setNumero('');
    setBairro('');
    setAparelho('');
    setMarca('');
    setModelo('');
    setSerial('');
    setDefeito('');
    setAcessorios('');
    setPrevisao('');
    setValor('');
    setDescricao('');
    
  }, [open]);


    //busca com debounce

  useEffect(() => {
    if (!open) return;
    if (clienteSelecionado && cliente === clienteSelecionado.nome) return;
    const termo = (cliente || '').trim();
    if (termo.length < 2) { setSugestoes([]); return; }




    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/clientes/search', {
          params: { q: termo }, 
          signal: controller.signal,
        });
        setSugestoes(Array.isArray(data) ? data : []);
      } catch (err){
        if (!controller.signal.aborted) setSugestoes([]);
      }
    }, 300);

    return () => { clearTimeout(t); controller.abort(); };
  }, [cliente, clienteSelecionado, open]);


  const escolherCliente = (c) => {
    setCliente(c.nome);
    setClienteSelecionado(c);
    setTelefone(c.telefone || '');
    setEmail(c.email || '');
    setEndereco(c.endereco || '');
    setNumero(c.numero || '');
    setBairro(c.bairro || '');
    setSugestoes([]);

  };

  if (!open) return null;

  const validarAntesSalvar = () => {
    if (!clienteSelecionado) { setErroSalvar('Selecione um cliente válido.'); return false; }
    if (!defeito || !defeito.trim()) { setErroSalvar('Informe o defeito.'); return false; }
    if (!descricao || !descricao.trim()) { setErroSalvar('Informe a descrição.'); return false; }
    return true;
  };



const handleSubmit = async (e) => {
  e.preventDefault();
  if (salvando) return;
  setErroSalvar('');
  if (!validarAntesSalvar()) return;

  setSalvando(true);
  try {
    const payload = {
      categoria: aparelho || "Outros",
      marca: marca?.trim() || "",
      modelo: modelo?.trim() || "",
      serial: serial?.trim() || "",
      descricao: descricao?.trim() || "",
      status: "ABERTA",
      defeito: defeito?.trim() || "",
      acessorios: acessorios?.trim() || "",
      previsao_entrega: previsao?.trim() || "",
      valor: valor !== "" ? parseFloat(String(valor).replace(',', '.')) : null,
    };

    // Use o endpoint correto do backend (ajuste se for só /fichas)
    const { data } = await api.post(`/fichas/${clienteSelecionado.id}`, payload);

    onFichaAdicionada?.(data);
    try { window.dispatchEvent(new Event('app:refresh_data')); } catch (_) {}
    onClose?.();
  } catch (error) {
    console.error(error);
    setErroSalvar(error?.response?.data?.error || 'Erro ao salvar ficha. Tente novamente.');
  } finally {
    setSalvando(false);
  }
};


   

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
        <h2>Ficha Nova</h2>
        <form onSubmit={handleSubmit}>
          <div className="field-autocomplete">            
            <input
             type="text" 
             placeholder="Digite o nome do cliente" 
             value={cliente} 
             onChange={e => 
            { setCliente(e.target.value); 
              setClienteSelecionado(null); 
              setTelefone(''); 
              setEmail(''); 
              setEndereco(''); 
              setNumero(''); 
              setBairro(''); 
            }}
            autoFocus
            aria-autocomplete="list"
          />


          <FaMagnifyingGlass className="icon-search" />
          {sugestoes.length > 0 && (
            <ul className="suggestions" role="listbox">
              {sugestoes.map(c => (
                <li key={c.id} role="option" onClick={() => escolherCliente(c)} onKeyDown={(e) => e.key === 'Enter' && escolherCliente(c)} tabIndex={0}>
                  <strong>{c.nome}</strong>
                  {c.telefone ? <span> • {c.telefone} </span> : null}
                  {c.email ? <span> • {c.email} </span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

          {/* ---------------------Campos do cliente ----------------------*/}



          <input type="text" placeholder="Telefone" value={telefone} readOnly/>
          <input type="text" placeholder="Email" value={email} readOnly/>
          <input className="col-span-2" placeholder="Endereço" value={endereco} readOnly/>
          <input type="text" placeholder="Número" value={numero} readOnly/>
          <input type="text" placeholder="Bairro" value={bairro} readOnly/>

          {/* ---------------------Campos do aparelho ----------------------*/}
          <input type="text" placeholder="Aparelho" value={aparelho} onChange={e => setAparelho(e.target.value)}/>
          <input type="text" placeholder="Marca" value={marca} onChange={e => setMarca(e.target.value)}/>
          <input type="text" placeholder="Modelo" value={modelo} onChange={e => setModelo(e.target.value)}/>
          <input type="text" placeholder="Serial" value={serial} onChange={e => setSerial(e.target.value)}/>
          <input type="text" placeholder="Defeito" value={defeito} onChange={e => setDefeito(e.target.value)}/>
          <input type="text" placeholder="Acessórios" value={acessorios} onChange={e => setAcessorios(e.target.value)}/>
          <input type="text" placeholder="Previsão" value={previsao} onChange={e => setPrevisao(e.target.value)}/>
          <input type="number" placeholder="Valor" value={valor} onChange={e => setValor(e.target.value)}/>
          <input type="text" placeholder="Descrição" value={descricao} onChange={e => setDescricao(e.target.value)}/>

          {erroSalvar && <div className="error">{erroSalvar}</div>}
          

          {/* -------------------------------------------------------------*/}

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn" disabled={!clienteSelecionado || salvando}>
              {salvando ? 'Salvando...' : 'Salvar Ficha'}
            </button>
            
          </div>
        </form>
      </div>
    </div>
  );
}