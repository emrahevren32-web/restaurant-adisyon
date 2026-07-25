import { getDecisionRule } from './decision-rules'
import {
  createRiskItem,
  getPriorityFromRisk
} from './risk-analysis.service'
import type {
  DecisionSuggestion,
  DecisionSuggestionInput
} from './decision-support.types'

const slugify = (value: string) => (
  value.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
)

const createSuggestionId = (input: DecisionSuggestionInput) => (
  `dss_${slugify(input.ruleId)}_${slugify(input.relatedEntityType)}_${slugify(input.relatedEntityId || input.title)}`
)

export const createDecisionSuggestion = (
  input: DecisionSuggestionInput
): DecisionSuggestion => {
  const rule = getDecisionRule(input.ruleId)
  const riskItem = createRiskItem(input.ruleId, input.evidenceScore, input.reason)
  const priority = rule?.priority === 'URGENT' || riskItem.risk === 'CRITICAL'
    ? 'URGENT'
    : rule?.priority || getPriorityFromRisk(riskItem.risk)

  return {
    id: createSuggestionId(input),
    category: input.category,
    title: input.title,
    description: input.description,
    reason: input.reason,
    risk: riskItem.risk,
    riskScore: riskItem.score,
    priority,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedLotId: input.relatedLotId || '',
    relatedProductId: input.relatedProductId || '',
    relatedSupplierId: input.relatedSupplierId || '',
    relatedWorkOrderId: input.relatedWorkOrderId || '',
    branchId: input.branchId || '',
    warehouseId: input.warehouseId || '',
    status: 'OPEN',
    createdAt: input.createdAt || new Date().toISOString(),
    ruleId: input.ruleId,
    recommendation: {
      id: `${createSuggestionId(input)}_recommendation`,
      action: input.recommendationAction,
      expectedImpact: input.expectedImpact,
      ownerRole: input.ownerRole
    }
  }
}

export const dedupeSuggestions = (
  suggestions: DecisionSuggestion[]
) => Array.from(new Map(suggestions.map(suggestion => [suggestion.id, suggestion])).values())
  .sort((first, second) => (
    second.riskScore - first.riskScore
    || first.priority.localeCompare(second.priority)
    || first.title.localeCompare(second.title, 'tr-TR')
  ))
