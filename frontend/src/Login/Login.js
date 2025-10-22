import React, {useState, useEffect} from 'react'
import './Login.scss'
import Input from '../UI/Input';
import api from '../services/api';

import video from '../Assets/ficha.mp4'
import fundo from '../Assets/fundo.jpg'
import logo from '../Assets/logo.png'

import { FaUserShield} from "react-icons/fa";
import { BsFillShieldLockFill } from "react-icons/bs";
import { CiLogin } from "react-icons/ci";

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [showBg, setShowBg] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(()=> {
        const t = setTimeout(() => setShowBg(true), 200);
        return () => clearTimeout(t);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensagem('');
        if (!email || !password) {
            setMensagem('Preencha email e senha');
            return;
        }
        try {
            setLoading(true);
            const payload = {
                email: (email || '').trim().toLowerCase(),
                password: (password || '').trim()
            };
            const { data } = await api.post('/admin/login', payload);
            localStorage.setItem('token', data.access_token);
            window.location.href = '/dashboard';
        } catch (err) {
            const detail = err?.response?.data?.detail;
            setMensagem(detail || 'Erro ao fazer login');
        } finally {
            setLoading(false);
        }
    };

    return(
        <>
            <div className={`login-bg${showBg ? ' show' : ''}`} style={{ backgroundImage: `url(${fundo})`}}></div>
            <div className='loginPage'>
                <div className='container'>
                    <div className='videoDiv'>
                        <video src={video} autoPlay loop muted></video>
                        <div className='textDiv'>
                            <h2>Cadastre suas fichas de reparo</h2>
                            <p>organize seu emprendimento de forma simples e prática</p>
                        </div>
                    </div>
                    <div className='formDiv'>
                        <div className='headerDiv'>
                            <img src={logo} alt="Logo Imagem" />
                            <h3>Bem vindo ao Sistema de Fichas</h3>
                            <p>Faça o login para continuar</p>
                        </div>

                        <form action='' className='form grid' onSubmit={handleSubmit}>
                            {mensagem && <span className='showMessage'>{mensagem}</span>}

                            <Input
                                type="email"
                                placeholder="Email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={FaUserShield}
                            />

                            <Input
                                type="password"
                                placeholder="Senha"
                                id="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={BsFillShieldLockFill}
                            />

                            <button type='submit' className='btn flex' disabled={loading}>
                                <span>{loading ? 'Entrando...' : 'Entrar'}</span>
                                <CiLogin className='icon'/>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;