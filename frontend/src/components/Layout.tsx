import { useEffect } from 'react';
import { Box, Flex, Heading, Button, Link as ChakraLink, HStack } from '@chakra-ui/react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppCache } from '../contexts/AppCacheContext';
import { Outlet } from 'react-router-dom';

const SIDEBAR_W = 240;

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
        <Box as="nav" flex={1}>
          <ChakraLink
            as={RouterLink}
            to="/"
            display="block"
            px={3}
            py={2}
            mb={1}
            borderRadius="md"
            color="white"
            bg={location.pathname === '/' ? 'whiteAlpha.300' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200' }}
            transition="all 0.2s ease-in-out"
          >
            Início
          </ChakraLink>
          <ChakraLink
            as={RouterLink}
            to="/controle-empenhos"
            display="block"
            px={3}
            py={2}
            mb={1}
            borderRadius="md"
            color="white"
            bg={location.pathname === '/controle-empenhos' ? 'whiteAlpha.300' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200' }}
            transition="all 0.2s ease-in-out"
          >
            Controle de Empenhos
          </ChakraLink>
          <ChakraLink
            as={RouterLink}
            to="/movimentacao-diaria"
            display="block"
            px={3}
            py={2}
            mb={1}
            borderRadius="md"
            color="white"
            bg={location.pathname === '/movimentacao-diaria' ? 'whiteAlpha.300' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200' }}
            transition="all 0.2s ease-in-out"
          >
            Movimentação Diária
          </ChakraLink>
          <ChakraLink
            as={RouterLink}
            to="/empenhos-pendentes"
            display="block"
            px={3}
            py={2}
            mb={1}
            borderRadius="md"
            color="white"
            bg={location.pathname === '/empenhos-pendentes' ? 'whiteAlpha.300' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200' }}
            transition="all 0.2s ease-in-out"
          >
            Empenhos Pendentes
          </ChakraLink>
          <ChakraLink
            as={RouterLink}
            to="/provisionamento"
            display="block"
            px={3}
            py={2}
            mb={1}
            borderRadius="md"
            color="white"
            bg={location.pathname === '/provisionamento' ? 'whiteAlpha.300' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200' }}
            transition="all 0.2s ease-in-out"
          >
            Provisionamento
          </ChakraLink>
          <ChakraLink
            as={RouterLink}
            to="/analytics"
            display="block"
            px={3}
            py={2}
            mb={1}
            borderRadius="md"
            color="white"
            bg={location.pathname === '/analytics' ? 'whiteAlpha.300' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200' }}
            transition="all 0.2s ease-in-out"
          >
            Analytics
          </ChakraLink>
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