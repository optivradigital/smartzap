import { describe, it, expect } from 'vitest'
import { detectDelimiter, generateImportReport, type ParseResult } from '../lib/csv-parser'
import {
  isPaymentError,
  isRateLimitError,
  isRetryableError,
  getErrorCategory,
} from '../lib/whatsapp-errors'

// ─── csv-parser ──────────────────────────────────────────────────────────────

describe('detectDelimiter', () => {
  it('detecta vírgula como separador padrão', () => {
    expect(detectDelimiter('nome,telefone,email')).toBe(',')
  })

  it('detecta ponto-e-vírgula', () => {
    expect(detectDelimiter('nome;telefone;email')).toBe(';')
  })

  it('detecta tab', () => {
    expect(detectDelimiter('nome\ttelefone\temail')).toBe('\t')
  })

  it('detecta pipe', () => {
    expect(detectDelimiter('nome|telefone|email')).toBe('|')
  })

  it('usa vírgula como fallback para string vazia', () => {
    expect(detectDelimiter('')).toBe(',')
  })
})

function makeResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    success: true,
    contacts: [],
    invalidRows: [],
    duplicates: [],
    totalRows: 0,
    validRows: 0,
    ...overrides,
  }
}

describe('generateImportReport', () => {
  it('gera relatório sem erros', () => {
    const report = generateImportReport(makeResult({ validRows: 10, totalRows: 10 }))
    expect(report).toContain('10')
    expect(report).toContain('Relatório')
  })

  it('inclui erros no relatório quando existem', () => {
    const result = makeResult({
      validRows: 8,
      totalRows: 10,
      invalidRows: [
        { row: 2, reason: 'telefone inválido', data: 'abc' },
        { row: 5, reason: 'telefone inválido', data: '123' },
      ],
    })
    const report = generateImportReport(result)
    expect(report).toContain('Linha 2')
    expect(report).toContain('telefone inválido')
  })

  it('trunca lista de erros após 10', () => {
    const invalidRows = Array.from({ length: 15 }, (_, i) => ({
      row: i + 1,
      reason: 'erro',
      data: 'x',
    }))
    const report = generateImportReport(makeResult({ invalidRows, totalRows: 15 }))
    expect(report).toContain('mais 5 erros')
  })
})

// ─── whatsapp-errors ─────────────────────────────────────────────────────────

describe('isPaymentError', () => {
  it('identifica erro de pagamento (131042)', () => {
    expect(isPaymentError(131042)).toBe(true)
  })

  it('retorna false para erro não-pagamento', () => {
    expect(isPaymentError(130429)).toBe(false)
  })
})

describe('isRateLimitError', () => {
  it('identifica rate limit (130429)', () => {
    expect(isRateLimitError(130429)).toBe(true)
  })

  it('retorna false para outros erros', () => {
    expect(isRateLimitError(131042)).toBe(false)
  })
})

describe('isRetryableError', () => {
  it('erros de sistema são retentáveis', () => {
    expect(isRetryableError(500)).toBe(true)
  })
})

describe('getErrorCategory', () => {
  it('retorna unknown para código não mapeado', () => {
    expect(getErrorCategory(999999)).toBe('unknown')
  })
})
