import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  useToast,
  Text,
  Link,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { ok, error } = await login(email, password);
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Login realizado', status: 'success', duration: 2000 });
      navigate(from, { replace: true });
    } else {
      toast({ title: error ?? 'Erro ao entrar', status: 'error', duration: 4000 });
    }
  }

  return (
    <Box
      minH="100vh"
      bg="brand.sand"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
    >
      <Box
        w="full"
        maxW="md"
        bg="white"
        borderRadius="lg"
        boxShadow="md"
        p={8}
        borderWidth="1px"
        borderColor="brand.green"
      >
        <Heading size="lg" color="brand.darkGreen" mb={6} textAlign="center">
          Controle de Empenhos e Estoque
        </Heading>
        <Text color="gray.600" mb={6} textAlign="center" fontSize="sm">
          Entre com seu e-mail e senha
        </Text>
        <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel color="brand.darkGreen">E-mail</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                borderColor="gray.300"
                _focus={{ borderColor: 'brand.green', boxShadow: '0 0 0 1px var(--chakra-colors-brand-green)' }}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="brand.darkGreen">Senha</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                borderColor="gray.300"
                _focus={{ borderColor: 'brand.green', boxShadow: '0 0 0 1px var(--chakra-colors-brand-green)' }}
              />
            </FormControl>
            <Button
              type="submit"
              w="full"
              colorScheme="green"
              bg="brand.green"
              _hover={{ bg: 'brand.darkGreen' }}
              isLoading={submitting}
              loadingText="Entrando..."
            >
              Entrar
            </Button>
          </VStack>
        </form>
        <Text mt={4} textAlign="center" fontSize="sm" color="gray.600">
          Não tem conta?{' '}
          <Link as={RouterLink} to="/register" color="brand.green" fontWeight="medium" _hover={{ textDecoration: 'underline' }}>
            Cadastre-se
          </Link>
        </Text>
      </Box>
    </Box>
  );
}
