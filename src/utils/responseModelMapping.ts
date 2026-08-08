import type { MappingFieldEntry } from '../services/endpointsApi';

function getRefName(ref: unknown): string | null {
  if (typeof ref !== 'string') {
    return null;
  }

  const match = ref.match(/#\/components\/schemas\/(.+)$/);
  return match ? match[1] : null;
}

// The response model is a map of schema name -> schema, with the endpoint's
// root model first. A mapping's stored modelName is only a match for that root
// when the mapping was created after the response model was synced — mappings
// created from the endpoint path alone carry a derived guess (e.g. "VetId"),
// which resolves to nothing here. Preferring the stored name but falling back
// to the first schema keeps those mappings pointed at a real schema.
export function resolveResponseModelRootName(responseModel: unknown, preferredModelName?: string | null): string | null {
  if (!responseModel || typeof responseModel !== 'object' || Array.isArray(responseModel)) {
    return null;
  }

  const schemas = responseModel as Record<string, unknown>;
  if (preferredModelName && Object.prototype.hasOwnProperty.call(schemas, preferredModelName)) {
    return preferredModelName;
  }

  return Object.keys(schemas)[0] ?? null;
}

export function createFieldMappingsFromResponseModel(responseModel: unknown, rootModelName: string): MappingFieldEntry[] {
  if (!responseModel || typeof responseModel !== 'object' || Array.isArray(responseModel)) {
    return [];
  }

  const schemas = responseModel as Record<string, unknown>;

  const createEntries = (schemaName: string, visited = new Set<string>()): MappingFieldEntry[] => {
    if (visited.has(schemaName)) {
      return [];
    }

    const schema = schemas[schemaName];
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      return [];
    }

    const properties = (schema as { properties?: unknown }).properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return [];
    }

    const nextVisited = new Set(visited);
    nextVisited.add(schemaName);

    return Object.entries(properties as Record<string, unknown>).map<MappingFieldEntry>(([modelField, fieldSchema]) => {
      const normalizedFieldSchema =
        fieldSchema && typeof fieldSchema === 'object' && !Array.isArray(fieldSchema)
          ? fieldSchema as Record<string, unknown>
          : {};
      const directRefName = getRefName(normalizedFieldSchema.$ref);

      if (directRefName) {
        return {
          kind: 'MODEL',
          serviceInfo: {
            modelField,
            type: directRefName,
            format: '',
            modelName: directRefName,
          },
          fieldMappings: createEntries(directRefName, nextVisited),
        };
      }

      if (normalizedFieldSchema.type === 'array') {
        const items =
          normalizedFieldSchema.items && typeof normalizedFieldSchema.items === 'object' && !Array.isArray(normalizedFieldSchema.items)
            ? normalizedFieldSchema.items as Record<string, unknown>
            : null;
        const itemRefName = items ? getRefName(items.$ref) : null;

        if (itemRefName) {
          return {
            kind: 'LIST_OF_MODELS',
            serviceInfo: {
              modelField,
              type: 'array',
              format: '',
              modelName: itemRefName,
            },
            fieldMappings: createEntries(itemRefName, nextVisited),
          };
        }

        return {
          kind: 'LIST_OF_VALUES',
          serviceInfo: {
            modelField,
            type: 'array',
            format: items && typeof items.format === 'string' ? items.format : '',
          },
        };
      }

      return {
        kind: 'VALUE',
        serviceInfo: {
          modelField,
          type: typeof normalizedFieldSchema.type === 'string' ? normalizedFieldSchema.type : '',
          format: typeof normalizedFieldSchema.format === 'string' ? normalizedFieldSchema.format : '',
        },
      };
    });
  };

  return createEntries(rootModelName);
}
