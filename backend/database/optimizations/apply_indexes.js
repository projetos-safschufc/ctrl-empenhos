/**
 * Script para Aplicar Índices de Otimização
 * 
 * Executa os comandos SQL de criação de índices no banco de dados
 * Para ambiente INTRANET com PostgreSQL
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do banco de dados
const dbConfig = {
  user: process.env.DB_USER || 'abimael',
  password: process.env.DB_PASSWORD || 'abi123!@#qwe',
  host: process.env.DB_HOST || '10.28.0.159',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'safs',
  // Configurações para ambiente INTRANET
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 5, // Pool pequeno para ambiente interno
};

async function applyIndexes() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔗 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');
    
    // Ler o arquivo SQL com os índices
    const sqlFile = path.join(__dirname, '01_create_indexes.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Dividir em comandos individuais (separados por ponto e vírgula)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('/*'));
    
    console.log(`📊 Executando ${commands.length} comandos de otimização...`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Skip comentários e comandos vazios
      if (command.startsWith('--') || command.startsWith('/*') || command.trim() === '') {
        continue;
      }
      
      try {
        console.log(`\n[${i + 1}/${commands.length}] Executando: ${command.substring(0, 80)}...`);
        
        const startTime = Date.now();
        await client.query(command);
        const duration = Date.now() - startTime;
        
        console.log(`✅ Sucesso (${duration}ms)`);
        successCount++;
        
      } catch (error) {
        const errorMsg = error.message;
        
        // Verificar se é um erro de índice já existente (pode ser ignorado)
        if (errorMsg.includes('already exists') || errorMsg.includes('já existe')) {
          console.log(`⚠️  Índice já existe - pulando`);
          skipCount++;
        } else {
          console.error(`❌ Erro: ${errorMsg}`);
          errorCount++;
          
          // Continuar com outros índices mesmo se um falhar
          if (errorMsg.includes('does not exist') || errorMsg.includes('não existe')) {
            console.log(`ℹ️  Tabela/schema não existe - isso pode ser normal para views do DW`);
          }
        }
      }
    }
    
    console.log('\n📈 RESUMO DA OTIMIZAÇÃO:');
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`⚠️  Pulados: ${skipCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total: ${successCount + skipCount + errorCount}`);
    
    // Atualizar estatísticas das tabelas principais
    console.log('\n📊 Atualizando estatísticas do banco...');
    try {
      await client.query('ANALYZE ctrl.safs_catalogo');
      await client.query('ANALYZE ctrl.hist_ctrl_empenho');
      await client.query('ANALYZE ctrl.users');
      await client.query('ANALYZE public.empenho');
      console.log('✅ Estatísticas atualizadas com sucesso!');
    } catch (error) {
      console.warn('⚠️  Erro ao atualizar estatísticas:', error.message);
    }
    
    if (successCount > 0) {
      console.log('\n🚀 OTIMIZAÇÕES APLICADAS COM SUCESSO!');
      console.log('💡 Dicas para ambiente INTRANET:');
      console.log('   - Monitore o cache via /api/cache/stats');
      console.log('   - Use /api/cache/warmup após reinicializações');
      console.log('   - Considere executar VACUUM ANALYZE periodicamente');
    }
    
  } catch (error) {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Conexão fechada.');
  }
}

// Verificar se está sendo executado diretamente
if (require.main === module) {
  console.log('🔧 APLICANDO OTIMIZAÇÕES DE QUERIES CRÍTICAS');
  console.log('🏢 Ambiente: INTRANET');
  console.log('🗄️  Banco: PostgreSQL');
  console.log('=====================================\n');
  
  applyIndexes().catch(error => {
    console.error('💥 Erro durante aplicação dos índices:', error);
    process.exit(1);
  });
}

module.exports = { applyIndexes };