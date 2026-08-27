import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { PageContextProvider } from './context/PageContext.jsx'
import { ModelConfigProvider } from './context/ModelConfigContext.jsx'
import { AgentSessionProvider } from './context/AgentSessionContext.jsx'
import { PptExportProvider } from './context/PptExportContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <PageContextProvider>
        <ModelConfigProvider>
          <AgentSessionProvider>
            <PptExportProvider>
              <App />
            </PptExportProvider>
          </AgentSessionProvider>
        </ModelConfigProvider>
      </PageContextProvider>
    </HashRouter>
  </React.StrictMode>,
)
