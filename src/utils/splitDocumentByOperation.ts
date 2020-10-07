import { DocumentNode, visit, OperationTypeNode } from 'graphql'

import { DocumentsPair } from '../interfaces'

export const splitDocumentByOperation = (document: DocumentNode, operationType: OperationTypeNode): DocumentsPair => {
  const usedFragments = new Set<string>()

  const documentWithOperation: DocumentNode = visit(document, {
    OperationDefinition(operationDefinition) {
      if (operationDefinition.operation !== operationType) {
        return null
      }
    },
    FragmentSpread(fragmentSpread) {
      usedFragments.add(fragmentSpread.name.value)
    },
    FragmentDefinition(fragmentDefinition) {
      if (!usedFragments.has(fragmentDefinition.name.value)) {
        return null
      }
    },
  })

  usedFragments.clear()
  const documentWithoutOperation: DocumentNode = visit(document, {
    OperationDefinition(operationDefinition) {
      if (operationDefinition.operation === operationType) {
        return null
      }
    },
    FragmentSpread(fragmentSpread) {
      usedFragments.add(fragmentSpread.name.value)
    },
    FragmentDefinition(fragmentDefinition) {
      if (!usedFragments.has(fragmentDefinition.name.value)) {
        return null
      }
    },
  })

  return [
    documentWithOperation.definitions.length > 0 ? documentWithOperation : null,
    documentWithoutOperation.definitions.length > 0 ? documentWithoutOperation : null,
  ]
}
