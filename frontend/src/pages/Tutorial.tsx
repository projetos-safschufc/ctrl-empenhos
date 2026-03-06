import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  List,
  ListItem,
  Divider,
  useToast,
  HStack,
} from '@chakra-ui/react';
import { MdPictureAsPdf } from 'react-icons/md';

const printStyles = `
  @media print {
    body * { visibility: hidden; }
    #tutorial-content, #tutorial-content * { visibility: visible; }
    #tutorial-content {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      max-width: 100%;
      padding: 1rem 2rem;
      background: white;
    }
    .no-print { display: none !important; }
    #tutorial-content .tutorial-body { text-align: justify; }
  }
`;

export function Tutorial() {
  const toast = useToast();

  const handleExportPdf = () => {
    const style = document.createElement('style');
    style.id = 'tutorial-print-styles';
    style.textContent = printStyles;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const el = document.getElementById('tutorial-print-styles');
      if (el) el.remove();
    }, 500);
    toast({
      title: 'Use "Salvar como PDF" na janela de impressão para gerar o arquivo.',
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <Box>
      <style>{printStyles}</style>
      <HStack justify="space-between" align="center" mb={6} flexWrap="wrap" gap={2} className="no-print">
        <Heading size="lg" color="brand.darkGreen">
          Tutorial da Aplicação
        </Heading>
        <Button
          leftIcon={<MdPictureAsPdf />}
          colorScheme="green"
          size="sm"
          onClick={handleExportPdf}
        >
          Exportar PDF
        </Button>
      </HStack>

      <Box id="tutorial-content" bg="white" p={6} borderRadius="md" shadow="sm">
        <VStack align="stretch" spacing={6} className="tutorial-body">
          <Text textAlign="justify">
            Este tutorial descreve o uso da aplicação dividido em duas frentes: <strong>controle administrativo</strong> (gestão de estoque, movimentação, empenhos e provisionamento) e <strong>controle operacional</strong> (recebimento de notas fiscais e observações). O texto está organizado para consulta rápida e uso no dia a dia.
          </Text>

          <Divider />

          <Heading size="md" color="brand.darkGreen">
            Parte 1 — Atividade administrativa de controle
          </Heading>
          <Text textAlign="justify">
            As telas desta parte destinam-se a gestores e equipes que acompanham indicadores, movimentações e planejamento de compras. São elas: <strong>Gestão de Estoque</strong>, <strong>Movimentação Diária</strong>, <strong>Empenhos Pendentes</strong> e <strong>Provisionamento</strong>.
          </Text>

          <Heading size="sm" color="gray.700">
            1.1 Gestão de Estoque
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Visualizar e controlar os materiais cadastrados, com indicadores de consumo, estoque, cobertura e status (Normal, Atenção, Crítico), além de permitir exportação e edição de dados.
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Gestão de Estoque (ou Controle de Empenhos).
          </Text>
          <Text fontWeight="semibold" fontSize="sm">Principais funcionalidades:</Text>
          <List spacing={2} pl={4}>
            <ListItem textAlign="justify"><strong>Resumo no topo:</strong> Cartões com totais de Materiais, Pendências, Atenção e Crítico.</ListItem>
            <ListItem textAlign="justify"><strong>Filtros:</strong> Código, Responsável, Classificação, Setor, Status e &quot;Com registro&quot;. Use Aplicar e Atualizar.</ListItem>
            <ListItem textAlign="justify"><strong>Tabela:</strong> Uma linha por material/registro, com Status (Normal, Atenção, Crítico) e tooltip com detalhes.</ListItem>
            <ListItem textAlign="justify"><strong>Seleção e edição:</strong> Marque o checkbox para editar quantidade por embalagem, tipo de armazenamento, capacidade e observação.</ListItem>
            <ListItem textAlign="justify"><strong>Exportar Excel:</strong> Exporta todos os registros que atendem aos filtros (não apenas a página atual).</ListItem>
          </List>

          <Heading size="sm" color="gray.700">
            1.2 Movimentação Diária
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Consultar e exportar as movimentações de estoque por data e período (mês/ano).
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Movimentação Diária. Use os filtros de período e exporte para planilha quando necessário.
          </Text>

          <Heading size="sm" color="gray.700">
            1.3 Empenhos Pendentes
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Listar os empenhos em aberto (pendentes de atendimento), com filtros por código e número do empenho e exportação dos dados.
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Empenhos Pendentes. Use em conjunto com a Gestão de Estoque e a Lista de Empenhos.
          </Text>

          <Heading size="sm" color="gray.700">
            1.4 Provisionamento
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Montar listas de provisionamento com base em busca por código de material, visualizando média de consumo, estoques, registro de preços e tempo de abastecimento, e gerar PDF/CSV para solicitação de compras.
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Provisionamento. Defina quantidade a pedir e observações; exporte CSV ou gere PDF.
          </Text>

          <Divider />

          <Heading size="md" color="brand.darkGreen">
            Parte 2 — Atividade operacional de controle de recebimento de notas fiscais
          </Heading>
          <Text textAlign="justify">
            As telas desta parte são voltadas à operação de recebimento de notas fiscais e registro de observações. São elas: <strong>Lista de Empenhos</strong>, <strong>Lista de Recebimentos</strong>, <strong>Adicionar Observações</strong> e <strong>Editar Recebimento</strong>.
          </Text>

          <Heading size="sm" color="gray.700">
            2.1 Lista de Empenhos
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Consultar empenhos (por fornecedor, item, material, número de documento) e registrar ou acompanhar o recebimento dos itens, com exportação para PDF e Excel.
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Lista de Empenhos. Complementa a tela Empenhos Pendentes com foco na execução do recebimento.
          </Text>

          <Heading size="sm" color="gray.700">
            2.2 Lista de Recebimentos
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Visualizar os recebimentos já realizados (notas fiscais / itens recebidos), com filtros e exportação para PDF e Excel.
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Lista de Recebimentos. Use para conferir o que já foi recebido e para auditoria.
          </Text>

          <Heading size="sm" color="gray.700">
            2.3 Adicionar Observações
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Incluir ou atualizar observações em itens/empenhos ou recebimentos, centralizando o registro de informações textuais importantes para a operação.
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Adicionar Observações. Mantenha observações atualizadas para rastreabilidade.
          </Text>

          <Heading size="sm" color="gray.700">
            2.4 Editar Recebimento
          </Heading>
          <Text textAlign="justify">
            <strong>Objetivo:</strong> Alterar ou complementar dados de um recebimento já registrado (quantidades, datas, observações), garantindo consistência entre o que foi recebido e o que consta no sistema.
          </Text>
          <Text textAlign="justify">
            <strong>Onde acessar:</strong> Menu lateral → Editar Recebimento. Use quando for necessário corrigir um lançamento ou incluir informações que não estavam disponíveis no primeiro registro.
          </Text>

          <Divider />

          <Heading size="sm" color="brand.darkGreen">
            Resumo do fluxo recomendado
          </Heading>
          <Text textAlign="justify">
            <strong>Administrativo:</strong> Consulte Gestão de Estoque e Empenhos Pendentes para indicadores e pendências; use Movimentação Diária para detalhes de entradas e saídas; e Provisionamento para montar e exportar pedidos com base em consumo e estoque.
          </Text>
          <Text textAlign="justify">
            <strong>Operacional:</strong> Consulte a Lista de Empenhos para receber e registrar; use Lista de Recebimentos para conferir o que já foi recebido; Adicionar Observações para anotações importantes; e Editar Recebimento quando precisar corrigir ou complementar um recebimento.
          </Text>
          <Text textAlign="justify" fontSize="sm" color="gray.600" pt={2}>
            Para dúvidas ou sugestões sobre o uso da aplicação, consulte a equipe de suporte ou a documentação interna da sua instituição.
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
