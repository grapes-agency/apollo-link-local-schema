import type { FragmentMap } from '@apollo/client/utilities'
import type { FieldNode, ObjectTypeDefinitionNode } from 'graphql'

export type Resolver<Context = any> = (
  rootValue: any,
  args: any,
  context: Context,
  info: {
    field: FieldNode
    fragmentMap: FragmentMap
  }
) => any

export type Resolvers<Context = any> = Record<string, Record<string, Resolver<Context>>>

export type TypeMap = Map<string, ObjectTypeDefinitionNode>
