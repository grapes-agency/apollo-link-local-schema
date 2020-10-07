import { ApolloLink, NormalizedCacheObject, Operation, NextLink, FetchResult, Observable } from '@apollo/client'
import { LocalState } from '@apollo/client/core/LocalState'
import { DocumentNode } from 'graphql'

import { Resolvers, TypeMap, DocumentsPair } from './interfaces'
import { mergeDocuments, mapResolvers, splitDocumentByDirective, cleanResult, validate, splitDocumentByOperation } from './utils'

interface LocalSchemaLinkOptions<Context = any> {
  assumeLocal?: boolean
  discriminationDirective?: string
  typeDefs: DocumentNode | Array<DocumentNode>
  resolvers: Resolvers<Context>
  context?: Context | (() => Context)
  validateQuery?: boolean
}

export class LocalSchemaLink<Context = any> extends ApolloLink {
  private localState: LocalState<NormalizedCacheObject> | null = null
  private resolvers: Resolvers<Context>
  private processedDocuments = new Map<DocumentNode, DocumentsPair>()
  private context: Context | (() => Context) | undefined
  private assumeLocal: boolean
  private typeMap: TypeMap
  private validateQuery: boolean
  private discriminationDirective: string

  constructor({
    typeDefs,
    resolvers,
    context,
    assumeLocal,
    validateQuery = true,
    discriminationDirective = 'local',
  }: LocalSchemaLinkOptions<Context>) {
    super()
    this.context = context
    this.assumeLocal = Boolean(assumeLocal)
    const [mappedResolvers, typeMap] = mapResolvers(resolvers, mergeDocuments(Array.isArray(typeDefs) ? typeDefs : [typeDefs]))
    this.resolvers = mappedResolvers
    this.typeMap = typeMap
    this.validateQuery = validateQuery
    this.discriminationDirective = discriminationDirective
  }

  private getLocalState(operation: Operation) {
    if (!this.localState) {
      this.localState = new LocalState({
        cache: operation.getContext().cache,
        resolvers: this.resolvers as any,
      })
    }
    return this.localState
  }

  private splitDocumentByDirective(document: DocumentNode): DocumentsPair {
    if (this.processedDocuments.has(document)) {
      return this.processedDocuments.get(document)!
    }

    const documentsPair = splitDocumentByDirective(document, this.discriminationDirective)
    this.processedDocuments.set(document, documentsPair)
    return documentsPair
  }

  request(operation: Operation, forward?: NextLink): Observable<FetchResult> | null {
    const { query, variables } = operation
    const [localQuery, nonLocalQuery] = this.assumeLocal ? [query, null] : this.splitDocumentByDirective(query)

    let nonLocalObservable = Observable.of<FetchResult>({ data: {} })

    if (forward) {
      if (!localQuery) {
        return forward(operation)
      }

      if (nonLocalQuery) {
        // eslint-disable-next-line no-param-reassign
        operation.query = nonLocalQuery
        nonLocalObservable = forward(operation)
      }
    }

    const [subscriptionQuery, normalQuery] = splitDocumentByOperation(localQuery!, 'subscription')

    const localState = this.getLocalState(operation)

    let context: Context
    if (normalQuery) {
      return nonLocalObservable.flatMap(
        remoteResult =>
          new Observable(observer => {
            try {
              if (this.validateQuery) {
                validate({ document: localQuery, typeMap: this.typeMap })
              }
            } catch (error) {
              observer.error({ errors: [{ message: error.message }] })
              return
            }

            context = typeof this.context === 'function' ? (this.context as () => any)() : this.context

            localState
              .runResolvers({
                document: normalQuery,
                remoteResult,
                context,
                variables,
              })
              .then(({ data, errors }) => {
                observer.next({ data: cleanResult({ data, document: localQuery }), errors })
                observer.complete()
              })
              .catch(error => {
                observer.error({ errors: [{ message: error.message }] })
              })
          })
      )
    }

    return new Observable(observer => {
      let subscription: ZenObservable.Subscription

      localState
        .runResolvers({ document: subscriptionQuery, remoteResult: { data: {} }, context, variables })
        .then(({ data, errors }) => {
          if (!data) {
            observer.complete()
            return
          }

          if (errors) {
            observer.next({ data: null, errors })
            observer.complete()
            return
          }

          const observers: Array<Observable<any>> = []
          Object.entries(data as { [key: string]: Observable<any> }).forEach(([key, observable]) => {
            observers.push(observable.map(result => ({ [key]: result })))
          })

          subscription = Observable.of<FetchResult>({ data: {} })
            .concat(...observers)
            .subscribe(observer)
        })
        .catch(error => {
          observer.error({ errors: [{ message: error.message }] })
        })

      return () => {
        if (subscription) {
          subscription.unsubscribe()
        }
      }
    })
  }
}

export const createLocalSchemaLink = (options: LocalSchemaLinkOptions) => new LocalSchemaLink(options)
