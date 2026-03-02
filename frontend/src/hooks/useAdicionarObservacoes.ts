import { useState, useCallback } from 'react';
import { fetchEmpenhosOpcoes, salvarObservacao, type EmpenhoOption } from '../api/plataforma';
import { OBSERVACAO_MIN, OBSERVACAO_MAX } from '../constants/plataforma';

export function useAdicionarObservacoes() {
  const [empenhos, setEmpenhos] = useState<EmpenhoOption[]>([]);
  const [empenhoSelecionado, setEmpenhoSelecionado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const carregarEmpenhos = useCallback(async () => {
    setLoadingOpcoes(true);
    setError(null);
    try {
      const list = await fetchEmpenhosOpcoes();
      setEmpenhos(list);
      if (list.length && !empenhoSelecionado) setEmpenhoSelecionado(list[0].nu_documento_siafi);
      return list;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setEmpenhos([]);
      throw e;
    } finally {
      setLoadingOpcoes(false);
    }
  }, [empenhoSelecionado]);

  const salvar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const obs = observacao.trim();
      if (obs.length < OBSERVACAO_MIN || obs.length > OBSERVACAO_MAX) {
        throw new Error(
          `Observação deve ter entre ${OBSERVACAO_MIN} e ${OBSERVACAO_MAX} caracteres.`
        );
      }
      if (!empenhoSelecionado.trim()) {
        throw new Error('Informe o empenho.');
      }
      await salvarObservacao({ empenho: empenhoSelecionado, observacao: obs });
      setSuccess(true);
      setObservacao('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [empenhoSelecionado, observacao]);

  const limpar = useCallback(() => {
    setObservacao('');
    setError(null);
    setSuccess(false);
  }, []);

  const invalidObservacao =
    observacao.trim().length > 0 &&
    (observacao.trim().length < OBSERVACAO_MIN || observacao.trim().length > OBSERVACAO_MAX);

  return {
    empenhos,
    empenhoSelecionado,
    setEmpenhoSelecionado,
    observacao,
    setObservacao,
    loading,
    loadingOpcoes,
    error,
    success,
    carregarEmpenhos,
    salvar,
    limpar,
    invalidObservacao,
    minChars: OBSERVACAO_MIN,
    maxChars: OBSERVACAO_MAX,
  };
}
