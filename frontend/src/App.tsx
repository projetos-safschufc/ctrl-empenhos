import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppCacheProvider } from './contexts/AppCacheContext';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PrivateRoute } from './components/PrivateRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ControleEmpenhos } from './pages/ControleEmpenhos';
import { Provisionamento } from './pages/Provisionamento';
import { MovimentacaoDiaria } from './pages/MovimentacaoDiaria';
import { EmpenhosPendentes } from './pages/EmpenhosPendentes';
import { AnalyticsDashboard } from './pages/AnalyticsDashboard';
import theme from './theme';

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <ErrorBoundary>
        <BrowserRouter>
          <AppCacheProvider>
            <AuthProvider>
              <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="controle-empenhos" element={<ControleEmpenhos />} />
              <Route path="movimentacao-diaria" element={<MovimentacaoDiaria />} />
              <Route path="empenhos-pendentes" element={<EmpenhosPendentes />} />
              <Route path="provisionamento" element={<Provisionamento />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
            </AuthProvider>
          </AppCacheProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ChakraProvider>
  );
}
