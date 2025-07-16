import React from 'react'
import { useSanitizedHtml } from '@/lib/hooks/useSanitizedHtml'
import { SanitizeConfig, SANITIZE_CONFIGS } from '@/lib/sanitize'

interface SanitizedHtmlProps {
  html: string | null | undefined
  config?: SanitizeConfig
  className?: string
  style?: React.CSSProperties
  fallback?: React.ReactNode
}

/**
 * Componente para renderizar HTML sanitizado de forma segura
 * Substitui o uso direto de dangerouslySetInnerHTML
 */
export function SanitizedHtml({ 
  html, 
  config = SANITIZE_CONFIGS.EMAIL,
  className,
  style,
  fallback = null
}: SanitizedHtmlProps) {
  const sanitizedHtml = useSanitizedHtml(html, config)
  
  if (!sanitizedHtml) {
    return <>{fallback}</>
  }
  
  return (
    <div 
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}

/**
 * Componente específico para templates de email
 */
export function SanitizedTemplateHtml({ 
  html, 
  className,
  style,
  fallback = null
}: Omit<SanitizedHtmlProps, 'config'>) {
  return (
    <SanitizedHtml 
      html={html}
      config={SANITIZE_CONFIGS.TEMPLATE}
      className={className}
      style={style}
      fallback={fallback}
    />
  )
}

/**
 * Componente específico para preview de email
 */
export function SanitizedPreviewHtml({ 
  html, 
  className,
  style,
  fallback = null
}: Omit<SanitizedHtmlProps, 'config'>) {
  return (
    <SanitizedHtml 
      html={html}
      config={SANITIZE_CONFIGS.PREVIEW}
      className={className}
      style={style}
      fallback={fallback}
    />
  )
}

/**
 * Componente com configuração estrita para conteúdo não confiável
 */
export function SanitizedStrictHtml({ 
  html, 
  className,
  style,
  fallback = null
}: Omit<SanitizedHtmlProps, 'config'>) {
  return (
    <SanitizedHtml 
      html={html}
      config={SANITIZE_CONFIGS.STRICT}
      className={className}
      style={style}
      fallback={fallback}
    />
  )
}

// Componente inline para casos simples
export const SafeHtml = SanitizedHtml