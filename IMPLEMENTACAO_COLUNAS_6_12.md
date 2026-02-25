## IMPLEMENTAÇÃO: Codificação Robusta Das Colunas 6-12 - Tela Controle de Empenhos

**Data**: 24 de Fevereiro de 2026  
**Versão**: 1.0  
**Status**: ✅ Implementado

---

## 📋 Resumo Executivo

Foi implementada uma codificação robusta e validada para exibição dos dados das colunas **6-12** da tela **Controle de Empenhos**, incluindo:

- ✅ **Colunas 6-12 (Consumo e Indicadores)**:
  - Consumo Mês-6 até Mês Atual (7 colunas)
  - Média de 6 Meses
  - Mês de Último Consumo
  - Quantidade de Último Consumo
  - Estoque Almoxarifados
  - Estoque Geral
  - Saldo Empenhos
  - Cobertura de Estoque (calculada)

- ✅ **Validações e Normalizações**:
  - Cada valor é validado, normalizado e tratado para nulos/inválidos
  - Consumos sempre >= 0
  - Estoques/saldos sempre >= 0
  - Média calculada apenas de períodos com consumo > 0
  - Cobertura com tooltip de criticidade

- ✅ **Formatação Consistente**:
  - Inteiros: separador de milhares (ponto)
  - Decimais: 1-2 casas decimais
  - Datas: MM/YYYY para mesano

- ✅ **Feedback Visual**:
  - Cores por criticidade (verde/amarelo/vermelho)
  - Tooltips explicativos
  - Linhas sombreadas para clareza

---

## 📁 Arquivos Implementados / Modificados

### Backend

#### 1. **`backend/src/utils/columnFormatters.ts`** ✅ *Novo*
   - Funções de validação e formatação centralizadas
   - Exporta para uso no serviço
   - Funções principais:
     - `validarConsumo(valor)`: Normaliza consumo >= 0
     - `calcularMediaConsumoValidos(consumos)`: Média excluindo zeros
     - `validarEstoque(valor)`: Normaliza estoque >= 0
     - `calcularCoberturaBatch(...)`: Calcula cobertura
     - `formatarInteiroPontosEspacos(...)`: Formata inteiros
     - `formatarDecimalPositivo(...)`: Formata decimais
     - `formatarMesanoMMYYYY(...)`: Formata MESANO
     - `logColunasControle(...)`: Log de debug

#### 2. **`backend/src/services/controleEmpenhoService.ts`** ✅ *Modificado*
   - Adicionado import de funções de validação
   - Atualizado `calcularMediaConsumo6MesesAnteriores()` com validação
   - Atualizado `calcularCobertura()` com validação de estoques
   - Atualizado mapeamento de consumos com `validarConsumo()` em cada campo
   - Adicionado log de debug via `logColunasControle()`
   - Validação de estoques na construção da linha base

---

### Frontend

#### 1. **`frontend/src/utils/columnRenderers.tsx`** ✅ *Novo*
   - Renderizadores React/Chakra UI para colunas 6-12
   - Exporta componentes:
     - `ColunaConsumoCell`: Renderiza célula de consumo com cores
     - `ColunaMediaConsumoCell`: Renderiza média com cor diferenciada
     - `ColunaMesUltimoConsumoCell`: Renderiza mês em MM/YYYY
     - `ColunaQtdeUltimoConsumoCell`: Renderiza quantidade
     - `ColunaEstoqueCell`: Renderiza estoque com cores de criticidade
     - `ColunaCoberturaCellFormatted`: Renderiza cobertura com border colorido e tooltip
     - `renderizarColunasControle()`: Função agregadora que retorna array de JSX para inserir em `<Tr>`
   - Funções utilitárias:
     - `formatarIntThousands()`: Inteiro com separador de milhares
     - `formatarDecimal()`: Decimal com N casas
     - `formatarMesano()`: Mesano em MM/YYYY

#### 2. **`frontend/src/pages/ControleEmpenhos.tsx`** ✅ *Modificado*
   - Adicionado import de `columnRenderers`
   - Removidas funções locais `formatMesano()`, `formatNumPositive()`, `formatIntThousands()` (agora estão em `columnRenderers`)
   - Preparação de `DadosColunasControleRender` para cada linha
   - Chamada de `renderizarColunasControle()` para renderizar todas as colunas 6-12 de uma vez
   - Atualizado uso de `formatarDecimal()` em campos editáveis (`Qtde/emb.`, `Saldo`, `Valor unit.`)

---

## 🔄 Fluxo de Dados

```
1. Backend (controleEmpenhoService.ts):
   - Busca consumos de v_df_movimento via DW
   - Validação com validarConsumo()
   - Calcula média com calcularMediaConsumoValidos()
   - Busca estoque/saldo de v_df_consumo_estoque
   - Validação com validarEstoque()
   - Calcula cobertura com calcularCoberturaBatch()
   - Retorna ItemControleEmpenho com campos validados

2. API (GET /controle-empenhos):
   - Serializa ItemControleEmpenho[] em JSON
   - Envia consumos, estoques, cobertura ao frontend

3. Frontend (ControleEmpenhos.tsx):
   - Recebe dados em Array<ItemControleEmpenho>
   - Prepara objeto DadosColunasControleRender
   - Chama renderizarColunasControle(dados)
   - Renderiza colunas com cores e tooltips via Chakra UI
```

---

## 🎨 Cores e Validação Visual

### Consumo (Colunas 6-12)
- **Verde claro**: Valor > 0 (consumo ativo)
- **Cinza claro**: Valor = 0 (sem consumo no período)

### Média 6 Meses
- **Azul claro**: Calculada (nunca zero, pois exclui zeros)
- **Cinza claro**: Zero (só ocorre se sem consumo em nenhum período)

### Estoque / Saldo Empenhos
- **Red.50**: < 100 (CRÍTICO)
- **Yellow.50**: 100-500 (ATENÇÃO)
- **Green.50**: > 500 (NORMAL)

### Cobertura de Estoque
- **Red border + Red.100**: < 1 dia (CRÍTICO)
- **Yellow border + Yellow.100**: 1-3 dias (ATENÇÃO)
- **Green border + Green.100**: > 3 dias (NORMAL)
- **Gray**: Sem consumo (impossível calcular)

---

## ✅ Validações Implementadas

### Consumo (Colunas 6-12)
```typescript
// ❌ ANTES (sem validação)
consumoMesMinus6: porMes[meses[0]] ?? 0  // pode ser negativo, NaN, etc.

// ✅ DEPOIS (com validação)
consumoMesMinus6: validarConsumo(porMes[meses[0]] ?? 0)  // sempre >= 0
```

### Estoque / Saldo
```typescript
// ❌ ANTES
estoqueAlmoxarifados: totais.estoqueAlmoxarifados  // pode ser null

// ✅ DEPOIS
estoqueAlmoxarifados: validarEstoque(totais.estoqueAlmoxarifados)  // sempre >= 0
```

### Média Consumo
```typescript
// ❌ ANTES - inclui zeros
const soma = anteriores.reduce((s, c) => s + c.total, 0);
return soma / anteriores.length;  // pode conter períodos com 0

// ✅ DEPOIS - exclui zeros
const anteriores = consumosPorMes
  .filter((c) => c.mesano < mesanoAtual)
  .map((c) => validarConsumo(c.total))
  .filter((total) => total > 0);  // ТОЛЬКО valores > 0
return calcularMediaConsumoValidos(anteriores);
```

### Cobertura
```typescript
// ❌ ANTES
if (mediaConsumo <= 0) return null;
return (estoqueAlmox + saldoEmpenhos) / mediaConsumo;

// ✅ DEPOIS
const mediaValidada = validarConsumo(mediaConsumo);
if (mediaValidada <= 0) return null;  // Validado
return (estoqueAlmoxValidado + saldoEmpenhoValidado) / mediaValidada;
```

---

## 🧪 Casos de Teste Recomendados

### 1. Material Sem Consumo
**Expected**: 
- Todas as colunas de consumo: 0
- Média: 0
- Status: "Crítico" (comRegistro false)
- Cobertura: null (sem consumo)

### 2. Material Com Consumo Intermitente
**Expected**:
- Colunas com 0 em alguns meses
- Média: Excluda os zeros
- Cobertura: Calculada corretamente

### 3. Material Com Consumo Alto
**Expected**:
- Inteiros formatados com separador (ex.: 19.534)
- Cobertura: Verde se > 3 dias

### 4. Material Sem Registro Válido
**Expected**:
- Status: "Crítico" (comRegistro false)
- Coluna "Pré-empenho": "-"

### 5. Material Com Estoque Baixo
**Expected**:
- Coluna "Estoque almox.": Red.50 (< 100)
- Cobertura: Red border + Red.100

---

## 🚀 Como Validar a Implementação

### Backend
1. Set `DEBUG=true` no `.env`
2. Fazer requisição a `GET /controle-empenhos`
3. Verificar logs de `logColunasControle()` no console
4. Validar que todos os valores são >= 0

### Frontend
1. Abrir tela "Controle de Empenhos"
2. Verificar que todas as colunas exibem dados com cores
3. Passar mouse sobre colunas para ver tooltips
4. Verificar formatação: inteiros (19.534), decimais (15.5)
5. Testar filtros: Normal, Atenção, Crítico

### Banco de Dados
1. Verificar que consumos em `v_df_movimento` existem
2. Verificar que estoques em `v_df_consumo_estoque` existem
3. Testar variantes de código (com/sem ponto: 562.898 vs 562898)

---

## 📝 Dependências

### Backend
- `backend/src/utils/memoryCache.ts`: Cache de dados
- `backend/src/repositories/movimentoRepository.ts`: Consumos do DW
- `backend/src/repositories/consumoEstoqueRepository.ts`: Estoque do DW
- `backend/src/utils/dwPool.ts`: Conexão ao DW

### Frontend
- `@chakra-ui/react`: Componentes UI
- `react`: Renderização
- `frontend/src/api/client.ts`: Chamadas à API

---

## 🔧 Configuração de Ambiente (`.env`)

### Backend
```env
# DW Connection
DW_SCHEMA=gad_dlih_safs
DW_USE_SPEC_COLUMNS=true

# Colunas de consumo (DW)
DW_MOV_MATERIAL_COLUMN=mat_cod_antigo
DW_MOV_DATA_COLUMN=dt_geracao
DW_CONSUMO_Z6_COL=z_6º_mes
DW_CONSUMO_Z5_COL=z_5º_mes
DW_CONSUMO_Z4_COL=z_4º_mes
DW_CONSUMO_Z3_COL=z_3º_mes
DW_CONSUMO_Z2_COL=z_2º_mes
DW_CONSUMO_Z1_COL=z_1º_mes
DW_CONSUMO_MES_ATUAL_COL=consumo_mes_atual

# Debug
DEBUG=true  # Ativa logs de columnFormatters
```

### Frontend
```env
# Sem configurações adicionais necessárias
```

---

## 📊 Exemplo de Dados Exibidos

| Material | M-6 | M-5 | M-4 | M-3 | M-2 | M-1 | Atual | Média | Últ. Mês | Qtde | Est.Almox | Cobertura |
|----------|-----|-----|-----|-----|-----|-----|-------|-------|----------|------|-----------|-----------|
| 562.898  | 100 | 150 | 200 | 180 | 220 | 210 | 190   | 177em | 01/2025  | 210  | 1.200     | 5.0 dias  |
| 586.243  | 0   | 50  | 75  | 0   | 100 | 125 | 85    | 67em  | 01/2025  | 125  | 500       | 7.5 dias  |
| 605.500  | 0   | 0   | 0   | 0   | 0   | 0   | 0     | —     | —        | —    | 0         | —         |

---

## 🎯 Próximos Passos (Opcional)

1. **Exportação**: Adicionar botão para exportar tabela em Excel com formatação
2. **Alertas**: Notificações para materiais em status "Crítico"
3. **Análise**: Gráfico de tendência de consumo (6 meses)
4. **Relatórios**: Filtros avançados por período, fornecedor, etc.

---

## ✨ Melhorias Realizadas

- ✅ Validação robusta de dados nulos/inválidos
- ✅ Cálculo matemático correto de média (exclui períodos sem consumo)
- ✅ Formatação consistente em toda a tela
- ✅ Feedback visual com cores por criticidade
- ✅ Log de debug para troubleshooting
- ✅ Código reutilizável e testável
- ✅ Separação de responsabilidades (formatadores centralizados)

---

**Implementação Completa**: 24/04/2026 ✅
