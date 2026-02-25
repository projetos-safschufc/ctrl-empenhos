import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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
import { useAuth } from '../contexts/AuthContext';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', status: 'warning', duration: 4000 });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', status: 'warning', duration: 4000 });
      return;
    }
    setSubmitting(true);
    const { ok, error } = await register(email.trim(), password, name.trim() || undefined);
    setSubmitting(false);
    if (ok) {
      toast({ title: 'Cadastro realizado. Bem-vindo!', status: 'success', duration: 2000 });
      navigate('/', { replace: true });
    } else {
      toast({ title: error ?? 'Erro ao cadastrar', status: 'error', duration: 4000 });
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
        <Heading size="lg" color="brand.darkGreen" mb={2} textAlign="center">
          Criar conta
        </Heading>
        <Text color="gray.600" mb={6} textAlign="center" fontSize="sm">
          Preencha os dados para se cadastrar
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
            <FormControl>
              <FormLabel color="brand.darkGreen">Nome (opcional)</FormLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
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
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                borderColor="gray.300"
                _focus={{ borderColor: 'brand.green', boxShadow: '0 0 0 1px var(--chakra-colors-brand-green)' }}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="brand.darkGreen">Confirmar senha</FormLabel>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
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
              loadingText="Cadastrando..."
            >
              Cadastrar
            </Button>
          </VStack>
        </form>
        <Text mt={4} textAlign="center" fontSize="sm" color="gray.600">
          Já tem conta?{' '}
          <Link as={RouterLink} to="/login" color="brand.green" fontWeight="medium" _hover={{ textDecoration: 'underline' }}>
            Entrar
          </Link>
        </Text>
      </Box>
    </Box>
  );
}
