import { mergeResolvers } from '@graphql-tools/merge';
import { GraphQLScalarType, Kind } from 'graphql';
import { authResolvers } from './auth';
import { systemResolvers } from './systems';
import { diagnosticResolvers } from './diagnostics';
import { remediationResolvers } from './remediation';
import { reportResolvers } from './reports';
import { subscriptionResolvers } from './subscriptions';

// Custom scalar resolvers
const scalarResolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    serialize(value: any) {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return null;
    },
    parseValue(value: any) {
      if (typeof value === 'string') {
        return new Date(value);
      }
      return null;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return new Date(ast.value);
      }
      return null;
    }
  }),

  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'JSON custom scalar type',
    serialize(value: any) {
      return value;
    },
    parseValue(value: any) {
      return value;
    },
    parseLiteral(ast) {
      switch (ast.kind) {
        case Kind.STRING:
        case Kind.BOOLEAN:
          return ast.value;
        case Kind.INT:
        case Kind.FLOAT:
          return parseFloat(ast.value);
        case Kind.OBJECT:
          const value = Object.create(null);
          ast.fields.forEach(field => {
            value[field.name.value] = parseLiteral(field.value);
          });
          return value;
        case Kind.LIST:
          return ast.values.map(parseLiteral);
        default:
          return null;
      }
    }
  })
};

function parseLiteral(ast: any): any {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.OBJECT:
      const value = Object.create(null);
      ast.fields.forEach((field: any) => {
        value[field.name.value] = parseLiteral(field.value);
      });
      return value;
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    default:
      return null;
  }
}

// Export merged resolvers
export const resolvers = mergeResolvers([
  scalarResolvers,
  authResolvers,
  systemResolvers,
  diagnosticResolvers,
  remediationResolvers,
  reportResolvers,
  subscriptionResolvers
]);