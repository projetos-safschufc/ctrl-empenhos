import { Box, Heading } from '@chakra-ui/react';
import { PLATAFORMA_TITLE, PLATAFORMA_COLORS } from '../../constants/plataforma';

interface PlataformaPageHeaderProps {
  subtitle: string;
}

export function PlataformaPageHeader({ subtitle }: PlataformaPageHeaderProps) {
  return (
    <Box mb={6}>
      <Heading
        size="md"
        color={PLATAFORMA_COLORS.detalheSecundario}
        textAlign="center"
        mb={2}
      >
        {PLATAFORMA_TITLE}
      </Heading>
      <Heading
        size="sm"
        color={PLATAFORMA_COLORS.detalhePrincipal}
        fontWeight="bold"
        textAlign={{ base: 'center', md: 'left' }}
      >
        {subtitle}
      </Heading>
    </Box>
  );
}
