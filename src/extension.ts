import {EvaluationError, EvaluationErrorType, EvaluationOptions, Evaluator} from '@croct/plug/sdk/evaluation';
import {Tracker} from '@croct/plug/sdk/tracking';
import {ObjectType, StringType, UnionType, ArrayType, NumberType, JsonObjectType} from '@croct/plug/sdk/validation';
import {Logger} from '@croct/plug/sdk';
import {Predicate, Variable} from '@croct/plug-rule-engine/predicate';
import {VariableMap} from '@croct/plug-rule-engine/context';
import {Extension} from '@croct/plug-rule-engine/extension';
import {Rule} from '@croct/plug-rule-engine/rule';

type CompositeExpressionDefinition = {
    conjunction: 'and' | 'or',
    subexpressions: string[],
}

type ExpressionDefinition = CompositeExpressionDefinition | string;

export type AudienceDefinition = {
    expression: ExpressionDefinition,
    options?: EvaluationOptions,
}

export type AudienceMap = {
    [key: string]: AudienceDefinition|string,
}

export type Options = {
    audiences: AudienceMap,
    evaluationOptions?: EvaluationOptions,
};

const compositeExpressionSchema = new ObjectType({
    required: ['conjunction', 'subexpression'],
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
    required: ['audiences'],
    properties: {
        audiences: audienceMapSchema,
        evaluationOptions: evaluationOptionsSchema,
    },
});

export default class AudiencesExtension implements Extension {
    private readonly evaluator: Evaluator;

    private readonly tracker: Tracker;

    private readonly audiences: AudienceMap;

    private readonly evaluationOptions: EvaluationOptions;

    private readonly logger: Logger;

    public constructor(options: Options, evaluator: Evaluator, tracker: Tracker, logger: Logger) {
        this.audiences = options.audiences;
        this.evaluationOptions = options.evaluationOptions ?? {timeout: 800};
        this.evaluator = evaluator;
        this.tracker = tracker;
        this.logger = logger;
    }

    public getPredicate({name, properties: {audience}}: Rule): Predicate|null {
        if (audience === undefined) {
            return null;
        }

        if (typeof audience !== 'string') {
            throw new Error(
                `Invalid audience specified for rule "${name}", `
                + `expected string but got ${typeof audience}.`,
            );
        }

        if (this.audiences[audience] === undefined) {
            throw new Error(`Audience "${audience}" does not exist.`);
        }

        return new Variable(audience);
    }

    public getVariables(): VariableMap {
        const variables: VariableMap = {};

        for (const [audience, definition] of Object.entries(this.audiences)) {
            variables[audience] = typeof definition === 'string'
                ? (): Promise<boolean> => this.evaluatePredicate(audience, {expression: definition})
                : (): Promise<boolean> => this.evaluatePredicate(audience, definition);
        }

        return variables;
    }

    private async evaluatePredicate(audience: string, {expression, options}: AudienceDefinition): Promise<boolean> {
        const generatedExpression = this.generateExpression(expression);

        if (generatedExpression === null) {
            this.logger.warn(`Invalid expression definition specified for audience "${audience}".`);

            return false;
        }

        const evaluation = this.evaluator.evaluate(generatedExpression, {
            ...this.evaluationOptions,
            ...(options ?? {}),
        });

        let result;

        try {
            result = await evaluation;
        } catch (error) {
            const {response: {type, title, detail}} = error as EvaluationError;

            this.logger.error(`Evaluation of audience "${audience}" failed: ${title}`);

            if (type === EvaluationErrorType.TIMEOUT) {
                const promise = this.tracker.track('eventOccurred', {
                    name: 'audienceTimeout',
                    audience: audience,
                    details: {
                        errorType: type,
                        errorTitle: title,
                        errorDetail: detail ?? '',
                    },
                });

                promise.catch(() => {
                    this.logger.debug(`Failed to log audience evaluation error "${title}".`);
                });
            }

            return false;
        }

        if (typeof result !== 'boolean') {
            this.logger.warn(
                `Evaluation result for audience "${audience}" is not boolean `
                + 'which may lead to unexpected results.',
            );
        }

        return result === true;
    }

    private generateExpression(definition: ExpressionDefinition): string|null {
        if (typeof definition === 'string') {
            return definition;
        }

        const {conjunction, subexpressions} = definition;

        if (subexpressions.length < 2) {
            return subexpressions[0] ?? null;
        }

        return `(${subexpressions.join(`) ${conjunction} (`)})`;
    }
}
