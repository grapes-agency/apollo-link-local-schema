/* eslint-disable default-case */
/* eslint-disable no-restricted-syntax */
import { FragmentMap } from '@apollo/client/utilities'
import { FieldNode, FragmentDefinitionNode, InlineFragmentNode } from 'graphql'

export const extendSelection = (node: FieldNode | FragmentDefinitionNode | InlineFragmentNode, fragmentMap: FragmentMap) => {
  const selections: Array<FieldNode> = []
  for (const selection of node.selectionSet?.selections || []) {
    switch (selection.kind) {
      case 'Field': {
        selections.push(selection)
        break
      }
      case 'FragmentSpread': {
        const fragment = fragmentMap[selection.name.value]
        selections.push(...extendSelection(fragment, fragmentMap))
        break
      }
      case 'InlineFragment': {
        selections.push(...extendSelection(selection, fragmentMap))
        break
      }
    }
  }
  return selections
}
