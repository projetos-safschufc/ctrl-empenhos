/**
 * Tema simples e limpo para a aplicação
 * Sem funcionalidades de Dark Mode
 */

import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#E6F3FF',
      100: '#BAE0FF',
      200: '#8CCDFF',
      300: '#5EB9FF',
      400: '#30A6FF',
      500: '#0693E3',
      600: '#145D50',
      700: '#04578D',
      800: '#033962',
      900: '#021B37',
    },
    plataforma: {
      predominante: '#FFFFFF',
      detalhePrincipal: '#8BC547',
      detalheSecundario: '#145D50',
      cinzaApoio: '#E5E5E5',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
  },
});

export default theme;