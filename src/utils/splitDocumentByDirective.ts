import { hasDirectives } from '@apollo/client/utilities'
import { DocumentNode, FieldNode, FragmentDefinitionNode, visit } from 'graphql'

import { DocumentsPair } from '../interfaces'

export const splitDocumentByDirective = (document: DocumentNode, splitDirective: string): DocumentsPair => {
  const hasLocalDirective = (field: FieldNode) =>
    Boolean(field.directives?.find(directive => directive.name.value === splitDirective))

  const localParentFields = new Set<FieldNode | FragmentDefinitionNode>()
  const usedFragments = new Set<string>()
  const localDocument: DocumentNode = visit(document, {
    OperationDefinition: {
      leave(operationDefinition) {
        if (operationDefinition.selectionSet.selections.length === 0) {
          return null
        }
      },
    },
    FragmentSpread(fragmentSpread) {
      usedFragments.add(fragmentSpread.name.value)
    },
    FragmentDefinition: {
      enter(fragmentDefinition) {
        if (usedFragments.has(fragmentDefinition.name.value)) {
          localParentFields.add(fragmentDefinition)
        }
      },
      leave(fragmentDefinition) {
        localParentFields.delete(fragmentDefinition)
      },
    },
    Field: {
      enter(field) {
        if (hasLocalDirective(field)) {
          localParentFields.add(field)
          return
        }

        if (localParentFields.size > 0 || hasDirectives([splitDirective], field)) {
          return
        }

        return null
      },
      leave(field) {
        localParentFields.delete(field)
      },
    },
  })

  usedFragments.clear()
  const nonLocalDocument: DocumentNode = visit(document, {
    OperationDefinition: {
      leave(operationDefinition) {
        if (operationDefinition.selectionSet.selections.length === 0) {
          return null
        }
      },
    },
    Field(field) {
      if (hasLocalDirective(field)) {
        return null
      }
    },
    FragmentSpread(fragmentSpread) {
      usedFragments.add(fragmentSpread.name.value)
    },
    FragmentDefinition(fragmentDefinition) {
      if (!usedFragments.has(fragmentDefinition.typeCondition.name.value)) {
        return null
      }
    },
  })

  return [
    localDocument.definitions.length > 0 ? localDocument : null,
    nonLocalDocument.definitions.length > 0 ? nonLocalDocument : null,
  ]
}
