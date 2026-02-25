/**
 * Middleware de Auditoria Automática
 * 
 * Captura automaticamente todas as requisições para auditoria
 * Registra logs detalhados de performance e segurança
 */

import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/auditService';
import { analyticsService } from '../services/analyticsService';

// Ações que devem ser auditadas
const AUDITABLE_ACTIONS = new Set([
  'POST', 'PUT', 'PATCH', 'DELETE' // Operações que modificam dados
]);

// Endpoints sensíveis que sempre devem ser auditados
const SENSITIVE_ENDPOINTS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/controle-empenhos/historico',
  '/api/cache/clear',
  '/api/cache/invalidate'
]);

// Endpoints que devem ser ignorados na auditoria
const IGNORED_ENDPOINTS = new Set([
  '/health',
  '/api/cache/stats',
  '/favicon.ico'
]);

interface RequestWithTiming extends Request {
  startTime?: number;
  auditLogged?: boolean;
}

/**
 * Middleware principal de auditoria
 */
export function auditMiddleware(req: RequestWithTiming, res: Response, next: NextFunction) {
  // Marcar início da requisição
  req.startTime = Date.now();
  
  // Verificar se deve ser auditado
  if (shouldAudit(req)) {
    // Logar início da requisição
    logRequestStart(req);
    
    // Interceptar resposta para capturar dados finais
    interceptResponse(req, res);
  }
  
  next();
}

/**
 * Determinar se a requisição deve ser auditada
 */
function shouldAudit(req: Request): boolean {
  const { method, path } = req;
  
  // Ignorar endpoints específicos
  if (IGNORED_ENDPOINTS.has(path)) {
    return false;
  }
  
  // Sempre auditar endpoints sensíveis
  if (SENSITIVE_ENDPOINTS.has(path)) {
    return true;
  }
  
  // Auditar operações que modificam dados
  if (AUDITABLE_ACTIONS.has(method)) {
    return true;
  }
  
  // Auditar requisições autenticadas (GET com dados sensíveis)
  if ((req as any).user && path.startsWith('/api/')) {
    return true;
  }
  
  return false;
}

/**
 * Logar início da requisição
 */
async function logRequestStart(req: Request) {
  try {
    const action = determineAction(req);
    const entityType = determineEntityType(req);
    
    if (action && entityType) {
      await auditService.logAction(
        req,
        action,
        entityType,
        undefined, // entityId será determinado na resposta se necessário
        undefined, // oldValues
        undefined, // newValues
        {
          requestStart: true,
          method: req.method,
          path: req.path,
          query: req.query,
          bodySize: JSON.stringify(req.body || {}).length
        }
      );
      
      (req as RequestWithTiming).auditLogged = true;
    }
  } catch (error) {
    console.error('[AuditMiddleware] Erro ao logar início da requisição:', error);
  }
}

/**
 * Interceptar resposta para capturar dados finais
 */
function interceptResponse(req: RequestWithTiming, res: Response) {
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Interceptar res.send()
  res.send = function(data: any) {
    finalizeAudit(req, res, data);
    return originalSend.call(this, data);
  };
  
  // Interceptar res.json()
  res.json = function(data: any) {
    finalizeAudit(req, res, data);
    return originalJson.call(this, data);
  };
  
  // Interceptar fim da resposta
  res.on('finish', () => {
    if (!req.auditLogged) {
      finalizeAudit(req, res, null);
    }
  });
}

/**
 * Finalizar auditoria com dados da resposta
 */
async function finalizeAudit(req: RequestWithTiming, res: Response, responseData: any) {
  if (req.auditLogged) return; // Evitar duplicação
  
  try {
    const executionTime = req.startTime ? Date.now() - req.startTime : 0;
    const statusCode = res.statusCode;
    
    // Atualizar log com informações de resposta
    await auditService.updateLogWithResponse(req, statusCode, executionTime);
    
    // Registrar atividade do usuário se autenticado
    const userId = (req as any).user?.userId;
    if (userId) {
      const activityType = determineActivityType(req);
      if (activityType) {
        await analyticsService.incrementUserActivity(userId, activityType, {
          endpoint: req.originalUrl,
          method: req.method,
          statusCode,
          executionTime
        });
      }
    }
    
    // Logar ações específicas com mais detalhes
    await logSpecificActions(req, res, responseData, executionTime);
    
    req.auditLogged = true;
    
  } catch (error) {
    console.error('[AuditMiddleware] Erro ao finalizar auditoria:', error);
  }
}

/**
 * Logar ações específicas com detalhes adicionais
 */
async function logSpecificActions(
  req: Request, 
  res: Response, 
  responseData: any, 
  executionTime: number
) {
  const { method, path } = req;
  const statusCode = res.statusCode;
  
  try {
    // Login/Logout
    if (path === '/api/auth/login') {
      const action = statusCode === 200 ? 'LOGIN' : 'LOGIN_FAILED';
      await auditService.logAction(
        req,
        action,
        'authentication',
        undefined,
        undefined,
        statusCode === 200 ? { success: true } : { success: false },
        {
          executionTime,
          statusCode,
          email: req.body?.email
        }
      );
    }
    
    if (path === '/api/auth/logout') {
      await auditService.logAction(
        req,
        'LOGOUT',
        'authentication',
        undefined,
        undefined,
        { success: statusCode === 200 },
        { executionTime, statusCode }
      );
    }
    
    // Salvamento de histórico
    if (path === '/api/controle-empenhos/historico' && method === 'POST') {
      await auditService.logAction(
        req,
        'SAVE_HISTORY',
        'hist_ctrl_empenho',
        req.body?.material_id,
        undefined,
        req.body,
        {
          executionTime,
          statusCode,
          success: statusCode < 400
        }
      );
    }
    
    // Exportações
    if (path.includes('export') || req.query.export) {
      await auditService.logAction(
        req,
        'DATA_EXPORT',
        determineEntityType(req) || 'unknown',
        undefined,
        undefined,
        {
          exportType: req.query.format || 'unknown',
          filters: req.query
        },
        {
          executionTime,
          statusCode,
          success: statusCode < 400
        }
      );
    }
    
    // Operações de cache (administrativas)
    if (path.startsWith('/api/cache/')) {
      await auditService.logAction(
        req,
        'CACHE_OPERATION',
        'system_cache',
        undefined,
        undefined,
        { operation: path.split('/').pop()?.toUpperCase() },
        {
          executionTime,
          statusCode,
          success: statusCode < 400
        }
      );
    }
    
  } catch (error) {
    console.error('[AuditMiddleware] Erro ao logar ações específicas:', error);
  }
}

/**
 * Determinar ação baseada na requisição
 */
function determineAction(req: Request): string | null {
  const { method, path } = req;
  
  // Mapeamento específico por endpoint
  const endpointActions: Record<string, string> = {
    '/api/auth/login': 'LOGIN_ATTEMPT',
    '/api/auth/logout': 'LOGOUT',
    '/api/controle-empenhos/dashboard': 'VIEW_DASHBOARD',
    '/api/controle-empenhos': 'VIEW_CONTROLE_EMPENHOS',
    '/api/movimentacao-diaria': 'VIEW_MOVIMENTACAO',
    '/api/provisionamento': 'VIEW_PROVISIONAMENTO'
  };
  
  if (endpointActions[path]) {
    return endpointActions[path];
  }
  
  // Mapeamento genérico por método HTTP
  const methodActions: Record<string, string> = {
    'GET': 'VIEW',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE'
  };
  
  return methodActions[method] || null;
}

/**
 * Determinar tipo de entidade baseado na requisição
 */
function determineEntityType(req: Request): string | null {
  const { path } = req;
  
  if (path.includes('controle-empenhos')) return 'controle_empenhos';
  if (path.includes('movimentacao-diaria')) return 'movimentacao_diaria';
  if (path.includes('provisionamento')) return 'provisionamento';
  if (path.includes('empenhos-pendentes')) return 'empenhos_pendentes';
  if (path.includes('auth')) return 'authentication';
  if (path.includes('cache')) return 'system_cache';
  if (path.includes('users')) return 'users';
  
  return 'unknown';
}

/**
 * Determinar tipo de atividade para métricas
 */
function determineActivityType(req: Request): string | null {
  const { path } = req;
  
  if (path === '/api/auth/login') return 'login';
  if (path === '/api/controle-empenhos/dashboard') return 'dashboard_view';
  if (path === '/api/controle-empenhos') return 'controle_empenhos_view';
  if (path === '/api/movimentacao-diaria') return 'movimentacao_view';
  if (path === '/api/provisionamento') return 'provisionamento_view';
  if (path.includes('export') || req.query.export) return 'data_export';
  if (path.includes('users') && req.method !== 'GET') return 'user_management';
  
  return null;
}

/**
 * Middleware específico para operações críticas
 */
export function criticalOperationAudit(
  operation: string,
  entityType: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      // Logar início da operação crítica
      await auditService.logAction(
        req,
        `${operation}_START`,
        entityType,
        req.params.id || req.body?.id,
        undefined,
        undefined,
        {
          criticalOperation: true,
          operation,
          startTime
        }
      );
      
      // Interceptar resposta
      const originalSend = res.send;
      res.send = function(data: any) {
        const executionTime = Date.now() - startTime;
        
        // Logar fim da operação
        auditService.logAction(
          req,
          `${operation}_END`,
          entityType,
          req.params.id || req.body?.id,
          undefined,
          res.statusCode < 400 ? { success: true } : { success: false, error: data },
          {
            criticalOperation: true,
            operation,
            executionTime,
            statusCode: res.statusCode
          }
        ).catch(error => {
          console.error('[CriticalAudit] Erro ao logar fim da operação:', error);
        });
        
        return originalSend.call(this, data);
      };
      
      next();
      
    } catch (error) {
      console.error('[CriticalAudit] Erro no middleware de operação crítica:', error);
      next();
    }
  };
}