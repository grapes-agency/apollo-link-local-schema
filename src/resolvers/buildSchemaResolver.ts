// https://github.com/graphql/graphql-spec/blob/master/spec/Section%204%20--%20Introspection.md

/* eslint-disable no-param-reassign */
import type {
  DocumentNode,
  SchemaDefinitionNode,
  DirectiveDefinitionNode,
  InputValueDefinitionNode,
  ASTNode,
  FieldDefinitionNode,
  EnumValueDefinitionNode,
  StringValueNode,
  ScalarTypeDefinitionNode,
} from 'graphql'
import { specifiedScalarTypes } from 'graphql'

import { Resolvers } from '../interfaces'
import {
  isDirectiveDefinition,
  isObjectTypeDefinition,
  isInterfaceTypeDefinition,
  isUnionTypeDefinition,
  isEnumTypeDefinition,
  isInputObjectTypeDefinition,
  isListType,
  isNonNullType,
  isTypeDefinition,
} from '../utils'

interface TypeRoot {
  node: ASTNode
}

interface DirectiveRoot {
  node: DirectiveDefinitionNode
}

interface InputRoot {
  node: InputValueDefinitionNode
}

interface FieldRoot {
  node: FieldDefinitionNode
}

interface EnumRoot {
  node: EnumValueDefinitionNode
}

const specifiedDefinitions: Array<ScalarTypeDefinitionNode> = specifiedScalarTypes.map(scalarType => ({
  kind: 'ScalarTypeDefinition',
  name: {
    kind: 'Name',
    value: scalarType.name,
  },
  ...(scalarType.description
    ? {
        description: {
          kind: 'StringValue',
          value: scalarType.description,
        },
      }
    : {}),
}))

const getDeprecateDirective = (node: FieldDefinitionNode | EnumValueDefinitionNode) =>
  node.directives?.find(directive => directive.name.value === 'deprecated')

const isDeprecated = (node: FieldDefinitionNode | EnumValueDefinitionNode) => Boolean(getDeprecateDirective(node))
const getDeprecationReason = (node: FieldDefinitionNode | EnumValueDefinitionNode) => {
  const directive = getDeprecateDirective(node)
  if (!directive) {
    return null
  }
  const reasonArg = directive.arguments?.find(arg => arg.name.value === 'reason')
  if (!reasonArg) {
    return null
  }

  return (reasonArg.value as StringValueNode).value
}

export const addSchemaResolver = (resolvers: Resolvers<any>, typeDefs: DocumentNode) => {
  const allTypes = [...specifiedDefinitions, ...typeDefs.definitions].filter(isTypeDefinition)
  const findType = (name: string) => allTypes.find(definition => 'name' in definition && definition.name?.value === name)

  if (!resolvers.Query) {
    resolvers.Query = {}
  }

  const schemaDefinition = typeDefs.definitions.find(definition => definition.kind === 'SchemaDefinition') as
    | SchemaDefinitionNode
    | undefined

  const findMainType = (name: string, fallbackName: string) => {
    const queryOperation = schemaDefinition?.operationTypes.find(operationType => operationType.operation === name)
    const typeName = queryOperation?.type.name.value || fallbackName
    const type = findType(typeName)
    if (type) {
      return {
        __typename: '__Type',
        node: type,
      }
    }

    return null
  }

  resolvers.Query.__schema = () => ({
    __typename: '__Schema',
  })

  resolvers.Query.__type = (_root, { name }) => {
    const type = findType(name)

    if (type) {
      return { __typename: '__Type', node: type }
    }

    return null
  }

  resolvers.__Schema = {
    description: () => schemaDefinition?.description?.value || null,
    queryType: () => findMainType('query', 'Query'),
    mutationType: () => findMainType('mutation', 'Mutation'),
    subscriptionType: () => findMainType('subscription', 'Subscription'),
    directives: () => typeDefs.definitions.filter(isDirectiveDefinition).map(node => ({ __typename: '__Directive', node })),
    types: () => allTypes.map(type => ({ __typename: '__Type', node: type })),
  }

  resolvers.__Type = {
    kind: ({ node }: TypeRoot) => {
      switch (node.kind) {
        case 'ScalarTypeDefinition': {
          return 'SCALAR'
        }
        case 'ObjectTypeDefinition': {
          return 'OBJECT'
        }
        case 'InterfaceTypeDefinition': {
          return 'INTERFACE'
        }
        case 'UnionTypeDefinition': {
          return 'UNION'
        }
        case 'EnumTypeDefinition': {
          return 'ENUM'
        }
        case 'InputObjectTypeDefinition': {
          return 'INPUT_OBJECT'
        }
        case 'ListType': {
          return 'LIST'
        }
        case 'NonNullType': {
          return 'NON_NULL'
        }
        default: {
          throw new Error(`Unknown kind ${node.kind}`)
        }
      }
    },
    name: ({ node }: TypeRoot) => ('name' in node ? node.name?.value || null : null),
    description: ({ node }: TypeRoot) => ('description' in node ? node.description?.value || null : null),
    fields: ({ node }: TypeRoot, { includeDeprecated = false }) => {
      if (!(isObjectTypeDefinition(node) || isInterfaceTypeDefinition(node))) {
        return null
      }
      return (
        node.fields
          ?.filter(field => includeDeprecated || isDeprecated(field))
          .map(field => ({ __typename: '__Field', node: field })) || []
      )
    },
    interfaces: ({ node }: TypeRoot) => {
      if (!(isObjectTypeDefinition(node) || isInterfaceTypeDefinition(node))) {
        return null
      }

      return node.interfaces?.map(iface => ({ __typename: '__Type', node: iface })) || []
    },
    possibleTypes: ({ node }: TypeRoot) => {
      if (!isUnionTypeDefinition(node)) {
        return null
      }

      // @todo add interface type here
      return node.types?.map(type => ({ __typename: '__Type', node: findType(type.name.value) })) || []
    },
    enumValues: ({ node }: TypeRoot, { includeDeprecated = false }) => {
      if (!isEnumTypeDefinition(node)) {
        return null
      }

      return (
        node.values
          ?.filter(value => includeDeprecated || isDeprecated(value))
          .map(value => ({ __typename: '__EnumValue', node: value })) || []
      )
    },
    inputFields: ({ node }: TypeRoot) => {
      if (!isInputObjectTypeDefinition(node)) {
        return null
      }

      return node.fields?.map(field => ({ __typename: '__InputValue', node: field })) || []
    },

    ofType: ({ node }: TypeRoot) => {
      if (!(isListType(node) || isNonNullType(node))) {
        return null
      }

      return { __typename: '__Type', node: node.type.kind === 'NamedType' ? findType(node.type.name.value) : node.type }
    },
  }

  resolvers.__Field = {
    name: ({ node }: FieldRoot) => node.name.value,
    description: ({ node }: FieldRoot) => node.description?.value || null,
    args: ({ node }: FieldRoot) => node.arguments?.map(arg => ({ __typename: '__InputValue', node: arg })) || [],
    type: ({ node }: FieldRoot) => ({
      __typename: '__Type',
      node: node.type.kind === 'NamedType' ? findType(node.type.name.value) : node.type,
    }),
    isDeprecated: ({ node }: FieldRoot) => isDeprecated(node),
    deprecationReason: ({ node }: FieldRoot) => getDeprecationReason(node),
  }

  resolvers.__InputValue = {
    name: ({ node }: InputRoot) => node.name.value,
    description: ({ node }: InputRoot) => node.description?.value || null,
    type: ({ node }: InputRoot) => ({
      __typename: '__Type',
      node: node.type.kind === 'NamedType' ? findType(node.type.name.value) : node.type,
    }),
    defaultValue: ({ node }: InputRoot) =>
      node.defaultValue && ('value' in node.defaultValue ? String(node.defaultValue.value) : null),
  }

  resolvers.__EnumValue = {
    name: ({ node }: EnumRoot) => node.name.value,
    description: ({ node }: EnumRoot) => node.description?.value || null,
    isDeprecated: ({ node }: EnumRoot) => isDeprecated(node),
    deprecationReason: ({ node }: EnumRoot) => getDeprecationReason(node),
  }

  resolvers.__Directive = {
    name: ({ node }: DirectiveRoot) => node.name.value,
    description: ({ node }: DirectiveRoot) => node.description?.value || null,
    locations: ({ node }: DirectiveRoot) => node.locations.map(location => location.value),
    args: ({ node }: DirectiveRoot) => node.arguments?.map(arg => ({ __typename: '__InputValue', node: arg })) || [],
    isRepeatable: ({ node }: DirectiveRoot) => node.repeatable,
  }
}
