import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from './lib/router'
import App from './App'
import OperatorLogin from './components/OperatorLogin'
import K8Portal from './components/k8/K8Portal'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    /^\/k8(?:\/|$)/.test(window.location.pathname) ? <K8Portal /> : (
      <OperatorLogin>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </OperatorLogin>
    )
  </React.StrictMode>,
)
