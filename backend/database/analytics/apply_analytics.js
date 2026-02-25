/**
 * Script para Aplicar Schema de Analytics e Auditoria
 * 
 * Executa os comandos SQL para criar tabelas de analytics e auditoria
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
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 5,
};

async function applyAnalyticsSchema() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔗 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');
    
    // Ler o arquivo SQL com o schema
    const sqlFile = path.join(__dirname, '01_create_analytics_schema.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📊 Aplicando schema de analytics e auditoria...');
    
    try {
      // Executar todo o script de uma vez (contém transações internas)
      await client.query(sqlContent);
      console.log('✅ Schema de analytics aplicado com sucesso!');
      
      // Verificar se as tabelas foram criadas
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'ctrl' 
          AND table_name IN ('audit_logs', 'system_metrics', 'user_activity_metrics')
        ORDER BY table_name
      `);
      
      console.log('\n📋 Tabelas criadas:');
      tablesResult.rows.forEach(row => {
        console.log(`  ✓ ctrl.${row.table_name}`);
      });
      
      // Verificar se as views foram criadas
      const viewsResult = await client.query(`
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'ctrl' 
          AND table_name LIKE 'v_%'
        ORDER BY table_name
      `);
      
      console.log('\n📊 Views criadas:');
      viewsResult.rows.forEach(row => {
        console.log(`  ✓ ctrl.${row.table_name}`);
      });
      
      // Verificar se as funções foram criadas
      const functionsResult = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'ctrl' 
          AND routine_type = 'FUNCTION'
          AND routine_name IN ('record_system_metric', 'increment_user_activity', 'cleanup_old_audit_logs')
        ORDER BY routine_name
      `);
      
      console.log('\n⚙️ Funções criadas:');
      functionsResult.rows.forEach(row => {
        console.log(`  ✓ ctrl.${row.routine_name}()`);
      });
      
      // Testar uma função
      console.log('\n🧪 Testando funcionalidades...');
      
      // Testar registro de métrica
      await client.query(`
        SELECT ctrl.record_system_metric('test_metric', 123.45, 'count', '{"source": "setup_test"}'::jsonb)
      `);
      console.log('  ✓ Função record_system_metric funcionando');
      
      // Verificar se o registro foi criado
      const testMetricResult = await client.query(`
        SELECT * FROM ctrl.system_metrics 
        WHERE metric_name = 'test_metric' 
        ORDER BY recorded_at DESC 
        LIMIT 1
      `);
      
      if (testMetricResult.rows.length > 0) {
        console.log('  ✓ Métrica de teste registrada com sucesso');
        
        // Limpar métrica de teste
        await client.query(`
          DELETE FROM ctrl.system_metrics WHERE metric_name = 'test_metric'
        `);
        console.log('  ✓ Métrica de teste removida');
      }
      
      console.log('\n🎉 SCHEMA DE ANALYTICS APLICADO COM SUCESSO!');
      console.log('\n💡 Próximos passos:');
      console.log('   1. Reinicie o servidor backend: npm run dev');
      console.log('   2. Acesse /api/analytics/dashboard para testar');
      console.log('   3. Acesse /api/audit/logs para ver logs de auditoria');
      console.log('   4. Configure limpeza automática de logs antigos');
      
    } catch (error) {
      console.error('❌ Erro ao aplicar schema:', error.message);
      
      // Tentar diagnóstico
      if (error.message.includes('does not exist')) {
        console.log('\n🔍 Diagnóstico:');
        console.log('   - Verifique se o schema "ctrl" existe');
        console.log('   - Execute: npm run db:init');
      }
      
      throw error;
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
  console.log('📊 APLICANDO SCHEMA DE ANALYTICS E AUDITORIA');
  console.log('🏢 Ambiente: INTRANET');
  console.log('🗄️  Banco: PostgreSQL');
  console.log('==========================================\n');
  
  applyAnalyticsSchema().catch(error => {
    console.error('💥 Erro durante aplicação do schema:', error);
    process.exit(1);
  });
}

module.exports = { applyAnalyticsSchema };