import {ArrayType, JsonObjectType, NumberType, ObjectType, StringType, UnionType} from '@croct/plug/sdk/validation';

const compositeExpressionSchema = new ObjectType({
    required: ['conjunction', 'subexpressions'],
    properties: {
        conjunction: new StringType({
            enumeration: ['and', 'or'],
        }),
        subexpressions: new ArrayType({
            items: new StringType({minLength: 1}),
        }),
    },
});

const evaluationOptionsSchema = new ObjectType({
    properties: {
        timeout: new NumberType({
            integer: true,
            minimum: 100,
        }),
        attributes: new JsonObjectType(),
    },
});

const audienceMapSchema = new ObjectType({
    propertyNames: new StringType({
        minLength: 1,
    }),
    additionalProperties: new UnionType(
        new StringType({minLength: 1}),
        new ObjectType({
            required: ['expression'],
            properties: {
                expression: new UnionType(
                    new StringType({minLength: 1}),
                    compositeExpressionSchema,
                ),
                options: evaluationOptionsSchema,
            },
        }),
    ),
});

export const optionsSchema = new ObjectType({
    required: ['map'],
    properties: {
        map: audienceMapSchema,
        defaultOptions: evaluationOptionsSchema,
    },
});
