import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  useToast,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  HStack,
  Textarea,
} from '@chakra-ui/react';
import { FiSave, FiX, FiSquare } from 'react-icons/fi';
import { PlataformaPageHeader } from '../../components/plataforma/PlataformaPageHeader';
import { useAdicionarObservacoes } from '../../hooks/useAdicionarObservacoes';
import { useAuth } from '../../contexts/AuthContext';
import { PLATAFORMA_COLORS } from '../../constants/plataforma';

export function AdicionarObservacoes() {
  const toast = useToast();
  const { user } = useAuth();
  const {
    empenhoSelecionado,
    setEmpenhoSelecionado,
    observacao,
    setObservacao,
    loading,
    error,
    success,
    salvar,
    limpar,
    invalidObservacao,
    minChars,
    maxChars,
  } = useAdicionarObservacoes();

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setLocalError(error);
      if (!error.includes('Módulo de recebimento') && !error.includes('não inicializado')) {
        toast({ title: error, status: 'error' });
      }
    } else {
      setLocalError(null);
    }
  }, [error, toast]);

  useEffect(() => {
    if (success) {
      toast({ title: 'Observação salva com sucesso.', status: 'success' });
    }
  }, [success, toast]);

  const handleSalvar = async () => {
    try {
      await salvar();
    } catch {
      // error already shown by toast
    }
  };

  const handleCancelar = () => {
    window.history.back();
  };

  return (
    <Box bg={PLATAFORMA_COLORS.predominante} p={6} borderRadius="lg" minH="100vh">
      <PlataformaPageHeader subtitle="Adicionar Observações" />

      <Box
        maxW="600px"
        mx="auto"
        p={6}
        borderWidth="1px"
        borderColor={PLATAFORMA_COLORS.cinzaApoio}
        borderRadius="md"
        bg={PLATAFORMA_COLORS.predominante}
      >
        {localError && (
          <Alert status="error" mb={4}>
            <AlertIcon />
            {localError}
          </Alert>
        )}

        <VStack align="stretch" spacing={4}>
          <FormControl>
            <FormLabel color={PLATAFORMA_COLORS.detalheSecundario}>
              Selecione o Empenho:
            </FormLabel>
            <Input
              value={empenhoSelecionado}
              onChange={(e) => setEmpenhoSelecionado(e.target.value)}
              placeholder="Digite o número do empenho (ex.: 2020NE804180)"
              bg={PLATAFORMA_COLORS.cinzaApoio}
              borderColor={PLATAFORMA_COLORS.cinzaApoio}
              borderWidth={!empenhoSelecionado.trim() ? '2px' : '1px'}
              _placeholder={{ color: 'gray.500' }}
            />
          </FormControl>

          <FormControl>
            <FormLabel color={PLATAFORMA_COLORS.detalheSecundario}>
              Observação:
            </FormLabel>
            <Textarea
              rows={4}
              placeholder={`Digite sua observação aqui (mínimo ${minChars}, máximo ${maxChars} caracteres)...`}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              bg={PLATAFORMA_COLORS.cinzaApoio}
              borderColor={invalidObservacao ? 'red.500' : PLATAFORMA_COLORS.cinzaApoio}
              _placeholder={{ color: 'gray.500' }}
            />
            <Text fontSize="xs" color="gray.500" mt={1}>
              {observacao.length} / {maxChars} caracteres
            </Text>
          </FormControl>

          <FormControl>
            <FormLabel color={PLATAFORMA_COLORS.detalheSecundario}>
              Usuário:
            </FormLabel>
            <Input
              isReadOnly
              value={user?.email ?? 'admin'}
              bg={PLATAFORMA_COLORS.cinzaApoio}
              borderColor={PLATAFORMA_COLORS.cinzaApoio}
            />
          </FormControl>

          <HStack spacing={4} pt={2}>
            <Button
              leftIcon={<FiSave />}
              bg={PLATAFORMA_COLORS.detalhePrincipal}
              color="white"
              colorScheme="green"
              onClick={handleSalvar}
              isDisabled={loading || invalidObservacao || !empenhoSelecionado.trim()}
              _hover={{ opacity: 0.9 }}
            >
              Salvar Observação
            </Button>
            <Button
              leftIcon={<FiX />}
              variant="outline"
              borderColor={PLATAFORMA_COLORS.detalheSecundario}
              color={PLATAFORMA_COLORS.detalheSecundario}
              onClick={handleCancelar}
              isDisabled={loading}
            >
              Cancelar
            </Button>
            <Button
              leftIcon={<FiSquare />}
              variant="outline"
              borderColor={PLATAFORMA_COLORS.detalheSecundario}
              color={PLATAFORMA_COLORS.detalheSecundario}
              onClick={limpar}
              isDisabled={loading}
            >
              Limpar
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
