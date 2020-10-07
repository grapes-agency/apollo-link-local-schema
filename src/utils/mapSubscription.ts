import { Observable } from '@apollo/client'
import { ObjectTypeDefinitionNode } from 'graphql'

import { Resolver } from '../interfaces'

import { addTypesnames } from './addTypenames'

interface SubscriptionResolver<T> {
  resolve?: (...args: Parameters<Resolver<any>>) => T | Promise<T>
  subscribe: (...args: Parameters<Resolver<any>>) => AsyncIterator<T> | Promise<AsyncIterator<T>>
}

export const isSubscriptionResolver = (resolver: any): resolver is SubscriptionResolver<any> =>
  resolver && 'subscribe' in resolver && typeof resolver.subscribe === 'function'

interface MapSubscriptionOptions<T> {
  fieldName: string
  resolver: SubscriptionResolver<T>
  objectType: ObjectTypeDefinitionNode
  typeMap: Map<string, ObjectTypeDefinitionNode>
}

export const mapSubscription = <C, T>({ fieldName, resolver, objectType, typeMap }: MapSubscriptionOptions<T>): Resolver<C> => (
  root,
  args,
  context,
  info
) => {
  const transform = resolver.resolve || ((value: any) => value[fieldName])

  return new Observable(observer => {
    let stopped = false
    Promise.resolve(resolver.subscribe(root, args, context, info)).then(asyncIterator => {
      if (stopped) {
        return
      }

      const pull = () => {
        asyncIterator.next().then(({ value, done }) => {
          if (value) {
            Promise.resolve(transform(value, args, context, info)).then(transformedValue => {
              if (stopped) {
                return
              }

              observer.next({
                [fieldName]: addTypesnames({
                  ...info,
                  data: transformedValue,
                  objectType,
                  typeMap,
                }),
              })
            })
          }
          if (done) {
            observer.complete()
          } else if (!stopped) {
            pull()
          }
        })
      }

      pull()
    })

    return () => {
      stopped = true
    }
  })
}
