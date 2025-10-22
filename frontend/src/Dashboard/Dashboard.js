import React, {useEffect, useState, useCallback} from 'react';
import './Dashboard.scss';
import userImg from '../Assets/user.png';
import api from '../services/api';
import {ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid} from 'recharts';
import Fichas from '../Ficha/Fichas.js';
import Clientes from '../Cliente/Clientes.js';
import Logs from '../Log/Logs.js';
import { useNavigate } from 'react-router-dom';
import ModalFoto from './ModalFoto';



const Dashboard = () => {

  const navigate = useNavigate();
  const [active, setActive] = useState('Visão Geral');
  const buttons = ['Visão Geral', 'Fichas', 'Clientes', 'Logs'];


  const [abertasPorMes, setAbertasPorMes] = useState([]);
  const [ultimosClientes, setUltimosClientes] = useState([]);
  const [ultimasFichas, setUltimasFichas] = useState([]);




  const [modalFotoOpen, setModalFotoOpen] = React.useState(false);
  const [fotoPreview, setFotoPreview] = React.useState(null);
  const [fotoFile, setFotoFile] = React.useState(null);
  const [fotoUrl, setFotoUrl] = React.useState(null);

  const REQUIRE_AUTH = process.env.REACT_APP_REQUIRE_AUTH === 'true';
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';



 

  const handleOpenModalFoto = () => {
    setFotoPreview(fotoUrl ? `${API_BASE}${fotoUrl}` : null);
    setModalFotoOpen(true)
  }

  const atualizarFotoUrl = useCallback(async () => {
    try {
      const { data } = await api.get('/usuario/me');
      setFotoUrl(data.foto_perfil || null);
    } catch (e) {
      console.error('Erro ao buscar dados do usuário:', e);
    }
  }, []);


  const carregarVisaoGeral = useCallback(async () => {
    
    try {
      let clientesRes = { data: { items: [] } };
      let fichasRes = { data: { items: [] } };
      let statsRes = { data: [] };

      try {
        clientesRes = await api.get('/clientes', { params: { page: 1, page_size: 5, q: '' } });
      } catch (e) {
        console.warn('Erro /clientes:', e);
      }

      try {
        fichasRes = await api.get('/fichas', { params: { page: 1, page_size: 5, q: '' } });
      } catch (e) {
        console.warn('Erro /fichas:', e);
      }

      try {
        statsRes = await api.get('/fichas/estatisticas', { params: { limit_months: 6 } });
      } catch (e) {
        console.warn('Erro /fichas/estatisticas:', e);
      }

      setUltimosClientes(clientesRes.data?.items || []);
      setUltimasFichas((fichasRes.data?.items || []).map(f => ({
        id: f.id,
        cliente: f.cliente,
        status: f.status,
        criado_em: f.criado_em,
      })));
      setAbertasPorMes(Array.isArray(statsRes.data) ? statsRes.data : []);
    } catch (error) {
      console.error('Erro ao carregar visão geral (unexpected):', error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (REQUIRE_AUTH && !token) {
      navigate('/');
    }

    atualizarFotoUrl();
    carregarVisaoGeral();
    const onRefresh = () => { carregarVisaoGeral(); };
    window.addEventListener('app:refresh_data', onRefresh);
    return () => { window.removeEventListener('app:refresh_data', onRefresh); };
  }, [navigate, atualizarFotoUrl, carregarVisaoGeral]);




  return (
    <div className='dashboard-root'>
      <aside className='sidebar'>
        <div className='logo'>E</div>
        <nav className='side-nav'>
            {buttons.map(b => (
              <button
                key={b}
                className={`nav-button ${active === b ? 'active' : ''}`}
                onClick={() => setActive(b)}
              >
                {b}
              </button>
            ))}
            <button className='nav-button logout' onClick={() => {
              localStorage.removeItem('token');
              navigate('/');
            }}>Sair</button>
        </nav>

        <div className='avatar'>     
          <img
            className='avatar-img'
            src={fotoUrl ? `${API_BASE}${fotoUrl}` : userImg}
            alt='Foto de usuário'
            onClick={handleOpenModalFoto}
            role='button'
            tabIndex={0}
            onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenModalFoto(); }}
            style={{ cursor: 'pointer' }}
          />


           
        </div>
      </aside>
      
      <main className='content'>
        <h1>{active}</h1>

        {active === 'Visão Geral' && (
          <div className='cards-grid'>
            {/* Card 1: Gráfico de barras */}
            <div className='card card-chart'>
              <div className='card-hd'>
                <span className='card-title'>Fichas abertas por mês</span>
                <button className='dots' aria-label='mais opções'>.....</button>
              </div>
              <div className='card-bd chart-wrap'>
                {abertasPorMes.length === 0 ? (
                  <div className='empty'>Sem dados</div>
                ) : (
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={abertasPorMes} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray='3 3' vertical={false} />
                      <XAxis dataKey='mes' tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey='total' fill='#3b82f6' barSize={32} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

             {/* Card 2: Últimos 5 clientes */}
            <div className='card'>
              <div className='card-hd'>
                <span className='card-title'>Últimos 5 clientes (5)</span>
                <button className='dots' aria-label='mais opções'>.....</button>
              </div>
              <div className='card-bd-list'>
                {ultimosClientes.length === 0 ? (
                  <div className='empty'>Sem dados</div>
                ) : (
                  ultimosClientes.map((c) => (
                    <div key={c.id} className='list-row'>
                      <div className='list-title'>{c.nome}</div>
                      <div className='list-meta'>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

       {/* Card 3: Últimas 5 fichas */}
            <div className='card'>
              <div className='card-hd'>
                <span className='card-title'>Últimas 5 fichas (5)</span>
                <button className='dots' aria-label='mais opções'>.....</button>
              </div>
              <div className='card-bd-list'>
                {ultimasFichas.length === 0 ? (
                  <div className='empty'>Sem dados</div>
                ) : (
                  ultimasFichas.map((f) => (
                    <div key={f.id} className='list-row'>
                      <div className='list-title'>#{f.id} • {f.cliente}</div>
                      <div className={`pill ${String(f.status || '').toLowerCase()}`}>{String(f.status || '').replace(/_/g,' ')}</div>
                      <div className='list-meta'>{new Date(f.criado_em).toLocaleDateString('pt-BR')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {active === "Fichas" && (
          <Fichas fichas={ultimasFichas} />
        )}

        {active === "Clientes" && (
          <Clientes />
        )}
        {active === "Logs" && (
          <Logs />
        )}

        
      </main>

      <ModalFoto
        modalFotoOpen={modalFotoOpen}
        setModalFotoOpen={setModalFotoOpen}
        fotoPreview={fotoPreview}
        setFotoPreview={setFotoPreview}
        fotoFile={fotoFile}
        setFotoFile={setFotoFile}
        atualizarFotoUrl={atualizarFotoUrl}
      />
    </div>
  );
};

export default Dashboard;
