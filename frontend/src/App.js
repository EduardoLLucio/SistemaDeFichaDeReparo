import Dashboard from './Dashboard/Dashboard';
import Login from './Login/Login';
import Rastreio from './Consulta/Rastreio';



import {
  createBrowserRouter,
  RouterProvider,
  Navigate,

}from "react-router-dom";

function Protected({children}) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" replace />

}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />
  },
  {
    path: '/dashboard',
    element: <Protected><Dashboard /></Protected>  
  },
  {
    path: '/rastreio',
    element: <Rastreio />
  },
  {
    path: '/rastreio/:codigo',
    element: <Rastreio />
  },
]);

function App() {
  return (
    <div>
      <RouterProvider router={router} />
    </div>
  )
}

export default App;
