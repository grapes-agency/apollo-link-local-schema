import type { FragmentMap } from '@apollo/client/utilities'
import type { ObjectTypeDefinitionNode, FieldNode } from 'graphql'

import { extendSelection } from './extendSelection'
import { getTypeName, isDeepListType } from './node'

interface ProcessResultOptions {
  field: FieldNode
  fragmentMap: FragmentMap
  objectType: ObjectTypeDefinitionNode
  typeMap: Map<string, ObjectTypeDefinitionNode>
  data: any
}

export const addTypesnames = ({ field, fragmentMap, objectType, typeMap, data }: ProcessResultOptions) => {
  if (data === undefined || data === null) {
    return null
  }

  if (typeof data !== 'object') {
    return data
  }

  const processedData: Record<string, any> = {
    ...data,
  }
  const selections = extendSelection(field, fragmentMap)
  selections.forEach(selection => {
    const selectionName = selection.name.value
    const fieldName = selection.alias?.value || selectionName
    const selectionField = objectType.fields?.find(f => f.name.value === selectionName)
    const currentData = data[fieldName]

    if (!selectionField) {
      return
    }

    const __typename = getTypeName(selectionField.type)
    const type = typeMap.get(__typename)

    if (!type) {
      return
    }

    if (isDeepListType(selectionField.type)) {
      if (!Array.isArray(currentData)) {
        return
      }

      processedData[fieldName] = currentData.map(d =>
        addTypesnames({
          field: selection,
          fragmentMap,
          objectType: type,
          typeMap,
          data: d,
        })
      )

      return
    }

    processedData[fieldName] = addTypesnames({
      field: selection,
      fragmentMap,
      objectType: type,
      typeMap,
      data: data[fieldName],
    })
  })

  const __typename = objectType.name.value
  return {
    ...processedData,
    __typename,
  }
}
