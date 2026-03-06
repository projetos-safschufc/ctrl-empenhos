import { useEffect } from 'react';
import { Box, Flex, Heading, Button, Link as ChakraLink, HStack, Divider } from '@chakra-ui/react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppCache } from '../contexts/AppCacheContext';
import { Outlet } from 'react-router-dom';

const SIDEBAR_W = 240;

/** Itens do menu lateral (path e rótulo). Divider fica entre o último item do primeiro bloco e o primeiro do segundo. */
const MENU_ITEMS_TOP: { to: string; label: string }[] = [
  { to: '/', label: 'Início' },
  { to: '/controle-empenhos', label: 'Gestão de Estoque' },
  { to: '/movimentacao-diaria', label: 'Movimentação Diária' },
  { to: '/empenhos-pendentes', label: 'Empenhos Pendentes' },
  { to: '/provisionamento', label: 'Provisionamento' },
  /*{ to: '/analytics', label: 'Analytics' },*/
];

const MENU_ITEMS_PLATAFORMA: { to: string; label: string }[] = [
  { to: '/plataforma/lista-empenhos', label: 'Lista de Empenhos' },
  { to: '/plataforma/lista-recebimentos', label: 'Lista de Recebimentos' },
  { to: '/plataforma/adicionar-observacoes', label: 'Adicionar Observações' },
  { to: '/plataforma/editar-recebimento', label: 'Editar Recebimento' },
];

/** Link de navegação do menu com estilo único e acessibilidade (aria-current). */
function NavMenuLink({ to, label, isActive }: { to: string; label: string; isActive: boolean }) {
  return (
    <ChakraLink
      as={RouterLink}
      to={to}
      display="block"
      px={3}
      py={2}
      mb={1}
      borderRadius="md"
      color="white"
      bg={isActive ? 'whiteAlpha.300' : 'transparent'}
      _hover={{ bg: 'whiteAlpha.200' }}
      transition="all 0.2s ease-in-out"
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
    </ChakraLink>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { prefetchIfNeeded } = useAppCache();
  const location = useLocation();

  useEffect(() => {
    if (user) prefetchIfNeeded();
  }, [user, prefetchIfNeeded]);

  return (
    <Flex minH="100vh" bg="gray.50">
      <Box
        w={`${SIDEBAR_W}px`}
        flexShrink={0}
        bg="brand.600"
        color="white"
        py={4}
        px={3}
        display="flex"
        flexDirection="column"
      >
        <HStack justify="space-between" mb={6} px={2}>
          <Heading size="md">
            Controle Empenhos
          </Heading>
        </HStack>
        <Box
          as="nav"
          flex={1}
          role="navigation"
          aria-label="Menu principal"
        >
          {MENU_ITEMS_TOP.map(({ to, label }) => (
            <NavMenuLink
              key={to}
              to={to}
              label={label}
              isActive={location.pathname === to}
            />
          ))}
          <Divider borderColor="whiteAlpha.600" my={3} />
          {MENU_ITEMS_PLATAFORMA.map(({ to, label }) => (
            <NavMenuLink
              key={to}
              to={to}
              label={label}
              isActive={location.pathname === to}
            />
          ))}
        </Box>
        <Box
          borderTopWidth="1px"
          borderColor="whiteAlpha.300"
          pt={4}
          mt={4}
        >
          <Box px={2} fontSize="sm" color="whiteAlpha.800" mb={2}>
            {user?.email}
          </Box>
          <Button
            size="sm"
            variant="outline"
            colorScheme="whiteAlpha"
            color="white"
            borderColor="whiteAlpha.400"
            _hover={{
              bg: 'whiteAlpha.200',
              borderColor: 'whiteAlpha.600',
            }}
            w="full"
            onClick={logout}
          >
            Sair
          </Button>
        </Box>
      </Box>
      <Box flex={1} overflow="auto" p={6}>
        <Outlet />
      </Box>
    </Flex>
  );
}
