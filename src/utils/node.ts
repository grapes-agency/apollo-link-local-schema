import {
  TypeNode,
  ObjectTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
} from 'graphql'

export const isObjectTypeDefinition = (node: { kind: string }): node is ObjectTypeDefinitionNode =>
  node.kind === 'ObjectTypeDefinition'
export const isObjectTypeExtension = (node: { kind: string }): node is ObjectTypeExtensionNode =>
  node.kind === 'ObjectTypeExtension'
export const isScalarTypeDefinition = (node: { kind: string }): node is ScalarTypeDefinitionNode =>
  node.kind === 'ScalarTypeDefinition'
export const isOperationDefinition = (node: { kind: string }): node is OperationDefinitionNode =>
  node.kind === 'OperationDefinition'
export const isFragmentDefinition = (node: { kind: string }): node is FragmentDefinitionNode => node.kind === 'FragmentDefinition'
export const getTypeName = (type: TypeNode): string => {
  if (type.kind === 'NonNullType' || type.kind === 'ListType') {
    return getTypeName(type.type)
  }
  return type.name.value
}
export const isListType = (type: TypeNode): boolean => {
  if (type.kind === 'NonNullType') {
    return isListType(type.type)
  }

  return type.kind === 'ListType'
}
