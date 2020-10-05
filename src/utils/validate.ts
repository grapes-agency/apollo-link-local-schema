import type { DocumentNode, SelectionSetNode, ObjectTypeDefinitionNode } from 'graphql'

import { TypeMap } from '../interfaces'

import { isOperationDefinition, isFragmentDefinition, getTypeName } from './node'

interface ValidateOptions {
  document: DocumentNode | null
  typeMap: TypeMap
}

export const validate = ({ document, typeMap }: ValidateOptions) => {
  if (!document) {
    return
  }

  const operations = document.definitions.filter(isOperationDefinition)
  const fragments = document.definitions.filter(isFragmentDefinition)

  fragments.forEach(fragment => {
    const typeName = fragment.typeCondition.name.value
    if (!typeMap.has(typeName)) {
      throw new Error(`Unknown type "${typeName}".`)
    }
  })

  const processSelectionSet = (selectionSet: SelectionSetNode, type: ObjectTypeDefinitionNode) => {
    selectionSet.selections.forEach(selection => {
      if (selection.kind === 'InlineFragment') {
        const typeName = selection.typeCondition!.name.value
        if (!typeMap.has(typeName)) {
          throw new Error(`Unknown type "${typeName}".`)
        }
        processSelectionSet(selection.selectionSet, type)
      }

      if (selection.kind === 'FragmentSpread') {
        const fragment = fragments.find(f => f.name.value === selection.name.value)
        if (!fragment) {
          throw new Error(`Unknown fragment "${selection.name.value}`)
        }
        processSelectionSet(fragment.selectionSet, type)
      }

      if (selection.kind === 'Field' && selection.name.value !== '__typename') {
        const field = type.fields?.find(f => f.name.value === selection.name.value)
        if (!field) {
          throw new Error(`Cannot query field "${selection.name.value}" on type "${type.name.value}".`)
        }

        const subType = typeMap.get(getTypeName(field.type))

        if (subType && selection.selectionSet) {
          processSelectionSet(selection.selectionSet, subType)
        }
      }
    })
  }

  operations.forEach(operation => {
    const operationName = operation.operation[0].toUpperCase() + operation.operation.substring(1)
    const type = typeMap.get(operationName)
    if (!type) {
      throw new Error(`Cannot query type ${operationName}`)
    }
    processSelectionSet(operation.selectionSet, type)
  })
}
