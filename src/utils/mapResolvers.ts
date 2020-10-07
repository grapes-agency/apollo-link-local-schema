/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
import { DocumentNode, InputValueDefinitionNode, print } from 'graphql'
import type { GraphQLScalarType } from 'graphql'

import { Resolvers, Resolver, TypeMap } from '../interfaces'

import { addTypesnames } from './addTypenames'
import { mapSubscription, isSubscriptionResolver } from './mapSubscription'
import { isObjectTypeDefinition, getTypeName, isScalarTypeDefinition } from './node'

export const mapResolvers = <C>(resolvers: Resolvers<C>, typeDefs: DocumentNode): [Resolvers<C>, TypeMap] => {
  const objectTypeDefinitions = typeDefs.definitions.filter(isObjectTypeDefinition)
  const typeMap: TypeMap = new Map(objectTypeDefinitions.map(definition => [definition.name.value, definition]))

  const mappedResolvers = Object.fromEntries(
    Object.entries(resolvers).map(([key, fields]) => {
      const typeDefinition = typeMap.get(key)

      if (!typeDefinition) {
        return [key, fields]
      }

      return [
        key,
        Object.fromEntries(
          Object.entries(fields).map(([fieldName, fieldResolver]) => {
            const fieldDefinition = typeDefinition.fields!.find(field => field.name.value === fieldName)

            if (!fieldDefinition) {
              throw new Error(`Resolver field ${fieldName} of type ${key} does not exist in your local schema`)
            }

            const requiredArgs: Array<InputValueDefinitionNode> = []
            const defaultArgs = (fieldDefinition.arguments || []).reduce<Record<string, any>>((defaults, arg) => {
              if (arg.defaultValue) {
                return {
                  ...defaults,
                  [arg.name.value]: 'value' in arg.defaultValue ? arg.defaultValue.value : null,
                }
              }
              requiredArgs.push(arg)
              return defaults
            }, {})

            const wrappedResolver: Resolver<C> = (root, args, context, info) => {
              for (const requiredArg of requiredArgs) {
                if (!(requiredArg.name.value in (args || {}))) {
                  throw new Error(
                    `Field "${info.field.name.value}" argument "${requiredArg.name.value}" of type "${print(
                      requiredArg.type
                    )}" is required, but it was not provided.`
                  )
                }
              }

              const mergedArgs = { ...defaultArgs, ...args }
              return Promise.resolve(fieldResolver(root, mergedArgs, context, info)).then(result => {
                const __typename = getTypeName(fieldDefinition.type)
                const targetType = typeMap.get(__typename)

                if (!targetType) {
                  return result
                }

                if (isSubscriptionResolver(result)) {
                  return mapSubscription({ fieldName, resolver: result, objectType: targetType, typeMap })(
                    root,
                    mergedArgs,
                    context,
                    info
                  )
                }

                return addTypesnames({
                  ...info,
                  data: result,
                  objectType: targetType,
                  typeMap,
                })
              })
            }
            return [fieldName, wrappedResolver]
          })
        ),
      ]
    })
  )

  // poor man scalar resolvers integration

  const scalarMap = new Map<string, GraphQLScalarType | undefined>(
    typeDefs.definitions
      .filter(isScalarTypeDefinition)
      .map(scalarDefinition => [scalarDefinition.name.value, mappedResolvers[scalarDefinition.name.value] as any])
  )

  for (const [scalarName, scalarResolver] of scalarMap) {
    if (!scalarResolver) {
      continue
    }
    for (const objectTypeDefinition of objectTypeDefinitions) {
      const objectName = objectTypeDefinition.name.value
      for (const field of objectTypeDefinition.fields || []) {
        if (getTypeName(field.type) !== scalarName) {
          continue
        }
        const fieldName = field.name.value
        if (mappedResolvers[objectName]?.[fieldName]) {
          continue
        }

        if (!mappedResolvers[objectName]) {
          mappedResolvers[objectName] = {}
        }

        mappedResolvers[objectName][fieldName] = root => scalarResolver.parseValue(root[fieldName])
      }
    }
  }
  return [mappedResolvers, typeMap]
}
