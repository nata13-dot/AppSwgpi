import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'react-toastify/dist/ReactToastify.css'
import './styles/app.css'
import App from './App'
import { store } from './store/store'
import ErrorBoundary from './components/common/ErrorBoundary'
import SystemPreferences from './components/layout/SystemPreferences'
import NativeBackButton from './components/layout/NativeBackButton'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NativeBackButton />
          <ErrorBoundary>
            <SystemPreferences />
            <App />
            <ToastContainer position="top-right" autoClose={3500} theme="colored" />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
)
