import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import TrayWidget from './components/TrayWidget'
import './index.css'

const isTrayWidget = new URLSearchParams(window.location.search).get('widget') === 'tray'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isTrayWidget ? <TrayWidget /> : <App />}
  </React.StrictMode>,
)
