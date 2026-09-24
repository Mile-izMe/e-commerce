import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiSuccessResponse } from './api-base.response.js';

export function ApiWrappedResponse(
  type: Type<unknown>,
  options: { status?: number; isArray?: boolean } = {},
) {
  const dataSchema = options.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(type) } }
    : { $ref: getSchemaPath(type) };
  return applyDecorators(
    ApiExtraModels(ApiSuccessResponse, type),
    ApiResponse({
      status: options.status ?? 200,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponse) },
          { properties: { data: dataSchema } },
        ],
      },
    }),
  );
}
