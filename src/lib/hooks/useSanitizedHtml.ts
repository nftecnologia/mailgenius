import { useMemo } from 'react'
import { sanitizeHtml, SanitizeConfig, SANITIZE_CONFIGS } from '@/lib/sanitize'

/**
 * Hook para sanitizar HTML de forma reativa
 * @param html - Conteúdo HTML para sanitizar
 * @param config - Configurações de sanitização (padrão: EMAIL)
 * @returns HTML sanitizado
 */
export function useSanitizedHtml(
  html: string | null | undefined,
  config: SanitizeConfig = SANITIZE_CONFIGS.EMAIL
): string {
  return useMemo(() => {
    if (!html) return ''
    return sanitizeHtml(html, config)
  }, [html, config])
}

/**
 * Hook para sanitizar HTML com configuração específica para templates
 * @param html - Conteúdo HTML para sanitizar
 * @returns HTML sanitizado para templates
 */
export function useSanitizedTemplateHtml(html: string | null | undefined): string {
  return useSanitizedHtml(html, SANITIZE_CONFIGS.TEMPLATE)
}

/**
 * Hook para sanitizar HTML com configuração específica para preview
 * @param html - Conteúdo HTML para sanitizar
 * @returns HTML sanitizado para preview
 */
export function useSanitizedPreviewHtml(html: string | null | undefined): string {
  return useSanitizedHtml(html, SANITIZE_CONFIGS.PREVIEW)
}

/**
 * Hook para sanitizar HTML com configuração estrita
 * @param html - Conteúdo HTML para sanitizar
 * @returns HTML sanitizado com configuração estrita
 */
export function useSanitizedStrictHtml(html: string | null | undefined): string {
  return useSanitizedHtml(html, SANITIZE_CONFIGS.STRICT)
}