// A/B Testing Statistical Analysis Library
// Comprehensive statistical functions for email marketing A/B tests

export interface ABTestVariant {
  id: string
  name: string
  type: 'subject_line' | 'content' | 'send_time' | 'from_name'
  content: string
  recipients: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  unsubscribed: number
  bounced: number
  revenue?: number
}

export interface ABTest {
  id: string
  workspace_id: string
  name: string
  description: string
  hypothesis: string
  test_type: 'subject_line' | 'content' | 'send_time' | 'from_name'
  status: 'draft' | 'running' | 'completed' | 'paused'
  variants: ABTestVariant[]
  control_variant_id: string
  winner_variant_id?: string
  confidence_level: number
  minimum_sample_size: number
  test_duration_days: number
  start_date?: string
  end_date?: string
  total_audience_size: number
  statistical_significance?: {
    p_value: number
    confidence_level: number
    is_significant: boolean
    winner_lift: number
  }
  created_at: string
  updated_at: string
}

export interface ABTestingEngine {
  createTest: (config: Partial<ABTest>) => Promise<ABTest>
  updateTest: (id: string, updates: Partial<ABTest>) => Promise<ABTest>
  runAnalysis: (testId: string) => Promise<ABTestResult>
  getRecommendations: (testId: string) => Promise<string[]>
}

export const TEST_TEMPLATES = {
  subject_line: {
    name: 'Linha de Assunto',
    description: 'Teste diferentes estilos de assunto',
    examples: ['Formal vs Casual', 'Com emoji vs Sem emoji', 'Curto vs Longo']
  },
  content: {
    name: 'Conteúdo',
    description: 'Teste diferentes formatos de conteúdo',
    examples: ['Texto vs Visual', 'CTA único vs Múltiplos', 'Newsletter vs Promocional']
  },
  send_time: {
    name: 'Horário de Envio',
    description: 'Teste diferentes horários',
    examples: ['Manhã vs Tarde', 'Dia de semana vs Final de semana', 'Horário comercial vs Noturno']
  },
  from_name: {
    name: 'Nome do Remetente',
    description: 'Teste diferentes remetentes',
    examples: ['Nome pessoal vs Empresa', 'Com cargo vs Sem cargo', 'Formal vs Informal']
  }
}

export interface ABTestResult {
  variant_a: ABTestVariant
  variant_b: ABTestVariant
  metrics: {
    open_rate_a: number
    open_rate_b: number
    click_rate_a: number
    click_rate_b: number
    conversion_rate_a: number
    conversion_rate_b: number
  }
  statistical_analysis: {
    open_rate_significance: StatisticalSignificance
    click_rate_significance: StatisticalSignificance
    conversion_significance: StatisticalSignificance
    confidence_level: number
    sample_size_adequate: boolean
    test_duration_days: number
    winner?: 'A' | 'B' | 'inconclusive'
    recommendation: string
  }
}

export interface StatisticalSignificance {
  metric_name: string
  variant_a_rate: number
  variant_b_rate: number
  improvement: number
  improvement_percentage: number
  p_value: number
  confidence_interval: [number, number]
  is_significant: boolean
  z_score: number
  power: number
}

export class ABTestAnalyzer {
  private confidenceLevel: number

  constructor(confidenceLevel = 0.95) {
    this.confidenceLevel = confidenceLevel
  }

  // Calculate proportion and standard error for binomial distribution
  private calculateProportionStats(successes: number, trials: number) {
    const proportion = trials > 0 ? successes / trials : 0
    const standardError = trials > 0 ? Math.sqrt(proportion * (1 - proportion) / trials) : 0
    return { proportion, standardError }
  }

  // Calculate Z-score for two proportions
  private calculateZScore(p1: number, n1: number, p2: number, n2: number): number {
    if (n1 === 0 || n2 === 0) return 0

    const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2)
    const pooledSE = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2))

    if (pooledSE === 0) return 0
    return (p1 - p2) / pooledSE
  }

  // Calculate p-value from Z-score (two-tailed test)
  private calculatePValue(zScore: number): number {
    // Approximation for standard normal distribution
    const absZ = Math.abs(zScore)

    if (absZ > 6) return 0
    if (absZ === 0) return 1

    // Using error function approximation
    const t = 1 / (1 + 0.3275911 * absZ)
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absZ * absZ)

    return 2 * (1 - erf) / 2
  }

  // Calculate confidence interval for difference in proportions
  private calculateConfidenceInterval(p1: number, n1: number, p2: number, n2: number): [number, number] {
    if (n1 === 0 || n2 === 0) return [0, 0]

    const diff = p1 - p2
    const se1 = Math.sqrt(p1 * (1 - p1) / n1)
    const se2 = Math.sqrt(p2 * (1 - p2) / n2)
    const seDiff = Math.sqrt(se1 * se1 + se2 * se2)

    // Z-value for 95% confidence
    const zValue = 1.96
    const margin = zValue * seDiff

    return [diff - margin, diff + margin]
  }

  // Calculate statistical power (simplified)
  private calculatePower(effect_size: number, n1: number, n2: number): number {
    if (n1 === 0 || n2 === 0) return 0

    // Simplified power calculation
    const totalN = n1 + n2
    const effectSizeAbs = Math.abs(effect_size)

    // Rule of thumb: power increases with sample size and effect size
    const power = Math.min(0.99, Math.max(0.05,
      1 - Math.exp(-0.5 * effectSizeAbs * Math.sqrt(totalN / 100))
    ))

    return power
  }

  // Analyze significance for a specific metric
  analyzeMetric(
    metricName: string,
    variantA: { successes: number; trials: number },
    variantB: { successes: number; trials: number }
  ): StatisticalSignificance {
    const rateA = variantA.trials > 0 ? variantA.successes / variantA.trials : 0
    const rateB = variantB.trials > 0 ? variantB.successes / variantB.trials : 0

    const improvement = rateB - rateA
    const improvementPercentage = rateA > 0 ? (improvement / rateA) * 100 : 0

    const zScore = this.calculateZScore(rateB, variantB.trials, rateA, variantA.trials)
    const pValue = this.calculatePValue(zScore)
    const confidenceInterval = this.calculateConfidenceInterval(rateB, variantB.trials, rateA, variantA.trials)
    const power = this.calculatePower(improvement, variantA.trials, variantB.trials)

    const significanceThreshold = 1 - this.confidenceLevel
    const isSignificant = pValue < significanceThreshold && Math.abs(zScore) > 1.96

    return {
      metric_name: metricName,
      variant_a_rate: rateA,
      variant_b_rate: rateB,
      improvement,
      improvement_percentage: improvementPercentage,
      p_value: pValue,
      confidence_interval: confidenceInterval,
      is_significant: isSignificant,
      z_score: zScore,
      power
    }
  }

  // Determine minimum sample size needed for a test
  calculateMinimumSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    power = 0.8,
    alpha = 0.05
  ): number {
    // Simplified sample size calculation
    const zAlpha = 1.96 // for alpha = 0.05 (two-tailed)
    const zBeta = 0.84  // for power = 0.8

    const p1 = baselineRate
    const p2 = baselineRate + minimumDetectableEffect

    const pooledP = (p1 + p2) / 2
    const numerator = (zAlpha * Math.sqrt(2 * pooledP * (1 - pooledP)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
    const denominator = (p2 - p1) ** 2

    return Math.ceil(numerator / denominator)
  }

  // Main analysis function
  analyzeABTest(variantA: ABTestVariant, variantB: ABTestVariant, testDurationDays: number): ABTestResult {
    // Calculate open rates
    const openRateAnalysis = this.analyzeMetric(
      'Open Rate',
      { successes: variantA.opened, trials: variantA.delivered },
      { successes: variantB.opened, trials: variantB.delivered }
    )

    // Calculate click rates (based on delivered emails)
    const clickRateAnalysis = this.analyzeMetric(
      'Click Rate',
      { successes: variantA.clicked, trials: variantA.delivered },
      { successes: variantB.clicked, trials: variantB.delivered }
    )

    // Calculate conversion rates (click-to-open)
    const conversionAnalysis = this.analyzeMetric(
      'Click-to-Open Rate',
      { successes: variantA.clicked, trials: variantA.opened },
      { successes: variantB.clicked, trials: variantB.opened }
    )

    // Determine if sample size is adequate
    const totalDelivered = variantA.delivered + variantB.delivered
    const minSampleSize = this.calculateMinimumSampleSize(0.20, 0.02) // 20% baseline, 2% improvement
    const sampleSizeAdequate = totalDelivered >= minSampleSize

    // Determine winner
    let winner: 'A' | 'B' | 'inconclusive' = 'inconclusive'
    let recommendation = 'Continue testing - no clear winner yet.'

    if (sampleSizeAdequate && testDurationDays >= 3) {
      const significantMetrics = [openRateAnalysis, clickRateAnalysis, conversionAnalysis].filter(m => m.is_significant)

      if (significantMetrics.length >= 2) {
        const avgImprovementA = significantMetrics.reduce((sum, m) => sum + (m.variant_a_rate > m.variant_b_rate ? 1 : 0), 0)
        const avgImprovementB = significantMetrics.reduce((sum, m) => sum + (m.variant_b_rate > m.variant_a_rate ? 1 : 0), 0)

        if (avgImprovementB > avgImprovementA) {
          winner = 'B'
          recommendation = 'Variant B is the clear winner. Deploy this version to all users.'
        } else if (avgImprovementA > avgImprovementB) {
          winner = 'A'
          recommendation = 'Variant A is performing better. Continue with the original version.'
        }
      } else if (testDurationDays >= 14) {
        recommendation = 'No significant difference found after 14 days. Consider this test inconclusive.'
      }
    } else if (!sampleSizeAdequate) {
      recommendation = `Need more data. Current sample: ${totalDelivered}, required: ${minSampleSize}`
    } else {
      recommendation = `Continue testing. Current duration: ${testDurationDays} days, minimum: 3 days`
    }

    return {
      variant_a: variantA,
      variant_b: variantB,
      metrics: {
        open_rate_a: openRateAnalysis.variant_a_rate,
        open_rate_b: openRateAnalysis.variant_b_rate,
        click_rate_a: clickRateAnalysis.variant_a_rate,
        click_rate_b: clickRateAnalysis.variant_b_rate,
        conversion_rate_a: conversionAnalysis.variant_a_rate,
        conversion_rate_b: conversionAnalysis.variant_b_rate
      },
      statistical_analysis: {
        open_rate_significance: openRateAnalysis,
        click_rate_significance: clickRateAnalysis,
        conversion_significance: conversionAnalysis,
        confidence_level: this.confidenceLevel,
        sample_size_adequate: sampleSizeAdequate,
        test_duration_days: testDurationDays,
        winner,
        recommendation
      }
    }
  }

  // Generate test recommendations
  generateTestRecommendations(historicalData: {
    avgOpenRate: number
    avgClickRate: number
    avgUnsubscribeRate: number
  }): string[] {
    const recommendations: string[] = []

    if (historicalData.avgOpenRate < 0.20) {
      recommendations.push('Test subject lines - your open rate is below industry average (20%)')
    }

    if (historicalData.avgClickRate < 0.025) {
      recommendations.push('Test email content and call-to-action - your click rate is below average (2.5%)')
    }

    if (historicalData.avgUnsubscribeRate > 0.005) {
      recommendations.push('Test send frequency - your unsubscribe rate is above average (0.5%)')
    }

    recommendations.push('Test send times - different time zones and schedules can improve engagement')
    recommendations.push('Test sender names - personalized sender names often improve open rates')

    return recommendations
  }
}

// Export default instance
export const abTestAnalyzer = new ABTestAnalyzer()

// Utility functions
export const ABTestUtils = {
  // Split audience for A/B test
  splitAudience(leadIds: string[], splitRatio = 0.5): { variantA: string[], variantB: string[] } {
    const shuffled = [...leadIds].sort(() => Math.random() - 0.5)
    const splitIndex = Math.floor(shuffled.length * splitRatio)

    return {
      variantA: shuffled.slice(0, splitIndex),
      variantB: shuffled.slice(splitIndex)
    }
  },

  // Generate test suggestions based on campaign type
  getTestSuggestions(campaignType: string): Array<{
    type: 'subject_line' | 'content' | 'send_time' | 'from_name'
    title: string
    description: string
    examples: string[]
  }> {
    const commonSuggestions: Array<{
      type: 'subject_line' | 'content' | 'send_time' | 'from_name'
      title: string
      description: string
      examples: string[]
    }> = [
      {
        type: 'subject_line' as const,
        title: 'Teste de Assunto',
        description: 'Compare diferentes estilos de linha de assunto',
        examples: [
          'Pergunta vs Afirmação',
          'Com emoji vs Sem emoji',
          'Curto vs Longo',
          'Urgência vs Curiosidade'
        ]
      },
      {
        type: 'send_time' as const,
        title: 'Teste de Horário',
        description: 'Encontre o melhor horário para seu público',
        examples: [
          'Manhã (9h) vs Tarde (14h)',
          'Segunda vs Quinta-feira',
          'Horário comercial vs Final de semana',
          'Manhã vs Noite'
        ]
      },
      {
        type: 'from_name' as const,
        title: 'Teste de Remetente',
        description: 'Teste diferentes nomes de remetente',
        examples: [
          'Nome pessoal vs Nome da empresa',
          'Cargo vs Nome próprio',
          'Formal vs Informal',
          'Com sobrenome vs Só primeiro nome'
        ]
      }
    ]

    if (campaignType === 'newsletter' || campaignType === 'campaign') {
      commonSuggestions.push({
        type: 'content' as const,
        title: 'Teste de Conteúdo',
        description: 'Compare diferentes abordagens de conteúdo',
        examples: [
          'Texto curto vs Texto longo',
          'Muitas imagens vs Poucas imagens',
          'CTA único vs Múltiplos CTAs',
          'Formato simples vs Rico em design'
        ]
      })
    }

    return commonSuggestions
  },

  // Format statistical results for display
  formatStatistics(significance: StatisticalSignificance): {
    improvementText: string
    confidenceText: string
    significanceText: string
    recommendationColor: 'green' | 'red' | 'yellow' | 'gray'
  } {
    const improvementText = significance.improvement >= 0
      ? `+${(significance.improvement_percentage).toFixed(1)}%`
      : `${(significance.improvement_percentage).toFixed(1)}%`

    const confidenceText = `${((1 - significance.p_value) * 100).toFixed(1)}% confiança`

    const significanceText = significance.is_significant
      ? 'Estatisticamente significativo'
      : 'Não significativo'

    let recommendationColor: 'green' | 'red' | 'yellow' | 'gray' = 'gray'

    if (significance.is_significant) {
      recommendationColor = significance.improvement > 0 ? 'green' : 'red'
    } else if (significance.p_value < 0.1) {
      recommendationColor = 'yellow'
    }

    return {
      improvementText,
      confidenceText,
      significanceText,
      recommendationColor
    }
  }
}
