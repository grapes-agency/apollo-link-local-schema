import { ApolloLink, NormalizedCacheObject, Operation, NextLink, FetchResult, Observable } from '@apollo/client'
import { LocalState } from '@apollo/client/core/LocalState'
import { DocumentNode } from 'graphql'

import { Resolvers, TypeMap } from './interfaces'
import { mergeDocuments, mapResolvers, DocumentsPair, splitDocument, cleanResult, validate } from './utils'

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

  private splitDocument(document: DocumentNode): DocumentsPair {
    if (this.processedDocuments.has(document)) {
      return this.processedDocuments.get(document)!
    }

    const documentsPair = splitDocument(document, this.discriminationDirective)
    this.processedDocuments.set(document, documentsPair)
    return documentsPair
  }

  request(operation: Operation, forward?: NextLink): Observable<FetchResult> | null {
    const { query, variables } = operation
    const [localQuery, nonLocalQuery] = this.assumeLocal ? [query, null] : this.splitDocument(query)

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

    const localState = this.getLocalState(operation)
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

          const context = typeof this.context === 'function' ? (this.context as () => Context)() : this.context

          localState
            .runResolvers({
              document: localQuery,
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
}

export const createLocalSchemaLink = (options: LocalSchemaLinkOptions) => new LocalSchemaLink(options)
