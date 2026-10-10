import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AppRouter } from './routes/AppRouter';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ConfirmProvider>
            <AppRouter />
          </ConfirmProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
