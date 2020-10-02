import type { DocumentNode, SelectionSetNode } from 'graphql'

import { isOperationDefinition, isFragmentDefinition } from './node'

interface CleanResultOptions {
  data: any
  document: DocumentNode | null
}

export const cleanResult = ({ data, document }: CleanResultOptions) => {
  if (!document) {
    return data
  }

  const operations = document.definitions.filter(isOperationDefinition)
  const fragments = document.definitions.filter(isFragmentDefinition)

  const processSelectionSet = (selectionSet: SelectionSetNode, currentData: any) => {
    if (currentData === null || currentData === undefined) {
      return null
    }

    const processedData: Record<string, any> = {}

    if (currentData.__typename) {
      processedData.__typename = currentData.__typename
    }

    selectionSet.selections.forEach(selection => {
      if (selection.kind === 'InlineFragment') {
        Object.assign(processedData, processSelectionSet(selection.selectionSet, currentData))
      }

      if (selection.kind === 'FragmentSpread') {
        const fragment = fragments.find(f => f.name.value === selection.name.value)
        if (fragment) {
          Object.assign(processedData, processSelectionSet(fragment.selectionSet, currentData))
        }
      }

      if (selection.kind === 'Field') {
        const selectionName = selection.alias?.value || selection.name.value
        const selectionData = currentData[selectionName]

        if (selection.selectionSet) {
          if (Array.isArray(selectionData)) {
            processedData[selectionName] = selectionData.map((d: any) => processSelectionSet(selection.selectionSet!, d))
          } else {
            processedData[selectionName] = processSelectionSet(selection.selectionSet, selectionData)
          }
        } else {
          processedData[selectionName] = selectionData || null
        }
      }
    })

    return processedData
  }

  return operations.reduce<Record<string, any>>(
    (cleanedData, definition) => ({
      ...cleanedData,
      ...processSelectionSet(definition.selectionSet, data),
    }),
    {}
  )
}
