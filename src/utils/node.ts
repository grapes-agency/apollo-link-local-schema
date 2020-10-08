import {
  TypeNode,
  NamedTypeNode,
  ObjectTypeExtensionNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  EnumTypeDefinitionNode,
  DirectiveDefinitionNode,
  InputObjectTypeDefinitionNode,
  ASTNode,
  InterfaceTypeDefinitionNode,
  ListTypeNode,
  NonNullTypeNode,
  TypeDefinitionNode,
  UnionTypeDefinitionNode,
} from 'graphql'

export const isObjectTypeDefinition = (node: ASTNode): node is ObjectTypeDefinitionNode => node.kind === 'ObjectTypeDefinition'
export const isInterfaceTypeDefinition = (node: ASTNode): node is InterfaceTypeDefinitionNode =>
  node.kind === 'InterfaceTypeDefinition'
export const isUnionTypeDefinition = (node: ASTNode): node is UnionTypeDefinitionNode => node.kind === 'UnionTypeDefinition'
export const isInputObjectTypeDefinition = (node: ASTNode): node is InputObjectTypeDefinitionNode =>
  node.kind === 'InputObjectTypeDefinition'
export const isEnumTypeDefinition = (node: ASTNode): node is EnumTypeDefinitionNode => node.kind === 'EnumTypeDefinition'
export const isObjectTypeExtension = (node: ASTNode): node is ObjectTypeExtensionNode => node.kind === 'ObjectTypeExtension'
export const isScalarTypeDefinition = (node: ASTNode): node is ScalarTypeDefinitionNode => node.kind === 'ScalarTypeDefinition'
export const isOperationDefinition = (node: ASTNode): node is OperationDefinitionNode => node.kind === 'OperationDefinition'
export const isDirectiveDefinition = (node: ASTNode): node is DirectiveDefinitionNode => node.kind === 'DirectiveDefinition'
export const isFragmentDefinition = (node: ASTNode): node is FragmentDefinitionNode => node.kind === 'FragmentDefinition'
export const isTypeDefinition = (node: ASTNode): node is TypeDefinitionNode =>
  [
    'ScalarTypeDefinition',
    'ObjectTypeDefinition',
    'InterfaceTypeDefinition',
    'UnionTypeDefinition',
    'EnumTypeDefinition',
    'InputObjectTypeDefinition',
  ].includes(node.kind)
export const isNamedType = (node: TypeNode): node is NamedTypeNode => node.kind === 'NonNullType'
export const isListType = (node: ASTNode): node is ListTypeNode => node.kind === 'ListType'
export const isNonNullType = (node: ASTNode): node is NonNullTypeNode => node.kind === 'NonNullType'
export const getTypeName = (type: TypeNode): string => {
  if (type.kind === 'NonNullType' || type.kind === 'ListType') {
    return getTypeName(type.type)
  }
  return type.name.value
}
export const isDeepListType = (type: TypeNode): boolean => {
  if (type.kind === 'NonNullType') {
    return isDeepListType(type.type)
  }

  return type.kind === 'ListType'
}
