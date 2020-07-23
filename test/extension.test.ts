import {Rule} from '@croct/plug-rule-engine/rule';
import {Predicate} from '@croct/plug-rule-engine/predicate';
import {Context} from '@croct/plug-rule-engine/context';
import {EvaluationErrorType, EvaluationError} from '@croct/plug/sdk/evaluation';
import {createEvaluatorMock, createLoggerMock, createTrackerMock} from './mocks';
import AudiencesExtension, {AudienceDefinition} from '../src/extension';

beforeEach(() => {
    jest.restoreAllMocks();
});

describe('An audience matcher extension', () => {
    test('should provide a predicate for a given audience name', async () => {
        const extension = new AudiencesExtension(
            {
                map: {
                    fooAudience: 'foo',
                },
            },
            createEvaluatorMock(),
            createTrackerMock(),
            createLoggerMock(),
        );

        const rule: Rule = {
            name: 'foo',
            properties: {
                audience: 'fooAudience',
            },
        };

        const predicate = extension.getPredicate(rule) as Predicate;
        const context = new Context({fooAudience: (): Promise<any> => Promise.resolve(true)});

        await expect(predicate.test(context)).resolves.toBe(true);
    });

    test.each<[any, string]>([
        [
            null,
            'Invalid audience specified for rule "foo", expected string but got object.',
        ],
        [
            {},
            'Invalid audience specified for rule "foo", expected string but got object.',
        ],
        [
            1,
            'Invalid audience specified for rule "foo", expected string but got number.',
        ],
        [
            'barAudience',
            'Audience "barAudience" does not exist.',
        ],
    ])('should log an error for invalid properties %p', (audience: any, message: string) => {
        const logger = createLoggerMock();

        const extension = new AudiencesExtension(
            {
                map: {
                    fooAudience: {
                        expression: 'foo',
                    },
                },
            },
            createEvaluatorMock(),
            createTrackerMock(),
            logger,
        );

        const rule: Rule = {
            name: 'foo',
            properties: {
                audience: audience,
            },
        };

        expect(extension.getPredicate(rule)).toBeNull();
        expect(logger.error).toHaveBeenCalledWith(message);
    });

    test('should not provide a predicate if the audience definition is undefined', () => {
        const extension = new AudiencesExtension(
            {
                map: {
                    fooAudience: {
                        expression: 'foo',
                    },
                },
            },
            createEvaluatorMock(),
            createTrackerMock(),
            createLoggerMock(),
        );

        const rule: Rule = {
            name: 'foo',
            properties: {
                audience: undefined,
            },
        };

        expect(extension.getPredicate(rule)).toBeNull();
    });

    test.each<[string, AudienceDefinition, string]>([
        [
            'simple',
            {expression: 'foo'},
            'foo',
        ],
        [
            'multiple-and',
            {
                expression: {
                    conjunction: 'and',
                    subexpressions: ['a', 'b'],
                },
            },
            '(a) and (b)',
        ],
        [
            'single-and',
            {
                expression: {
                    conjunction: 'and',
                    subexpressions: ['a'],
                },
            },
            'a',
        ],
        [
            'multiple-or',
            {
                expression: {
                    conjunction: 'or',
                    subexpressions: ['a', 'b'],
                },
            },
            '(a) or (b)',
        ],
        [
            'single-or',
            {
                expression: {
                    conjunction: 'and',
                    subexpressions: ['a'],
                },
            },
            'a',
        ],
    ])(
        'should evaluate the audience "%s"',
        async (audience: string, definition: AudienceDefinition, expression: string) => {
            const evaluator = createEvaluatorMock();

            evaluator.evaluate = jest.fn().mockResolvedValue(true);

            const extension = new AudiencesExtension(
                {
                    map: {
                        [audience]: definition,
                    },
                },
                evaluator,
                createTrackerMock(),
                createLoggerMock(),
            );

            const variables = extension.getVariables();

            await expect(variables[audience]()).resolves.toBe(true);

            expect(evaluator.evaluate).toHaveBeenCalledWith(expression, {timeout: 800});
        },
    );

    test('should evaluate the audience expression with the specified options', async () => {
        const evaluator = createEvaluatorMock();

        evaluator.evaluate = jest.fn().mockResolvedValue(true);

        const extension = new AudiencesExtension(
            {
                map: {
                    fooAudience: {
                        expression: 'foo',
                        options: {
                            timeout: 10,
                        },
                    },
                },
            },
            evaluator,
            createTrackerMock(),
            createLoggerMock(),
        );

        const variables = extension.getVariables();

        await expect(variables.fooAudience()).resolves.toBe(true);

        expect(evaluator.evaluate).toHaveBeenCalledWith('foo', {timeout: 10});
    });

    test('should log a warn message if the definition specified for an audience is invalid', async () => {
        const evaluator = createEvaluatorMock();
        const logger = createLoggerMock();

        evaluator.evaluate = jest.fn();

        const extension = new AudiencesExtension(
            {
                map: {
                    invalid: {
                        expression: {
                            conjunction: 'or',
                            subexpressions: [],
                        },
                    },
                },
            },
            evaluator,
            createTrackerMock(),
            logger,
        );

        const variables = extension.getVariables();

        await expect(variables.invalid()).resolves.toBe(false);

        expect(evaluator.evaluate).not.toHaveBeenCalled();

        expect(logger.warn).toHaveBeenCalledWith(
            'Invalid expression definition specified for audience "invalid".',
        );
    });

    test('should log a warn message if the result of the audience evaluation is not boolean', async () => {
        const evaluator = createEvaluatorMock();
        const logger = createLoggerMock();

        evaluator.evaluate = jest.fn().mockResolvedValue('bar');

        const extension = new AudiencesExtension(
            {
                map: {
                    fooAudience: 'foo',
                },
            },
            evaluator,
            createTrackerMock(),
            logger,
        );

        const variables = extension.getVariables();

        await expect(variables.fooAudience()).resolves.toBe(false);

        expect(logger.warn).toHaveBeenCalledWith(
            'Evaluation result for audience "fooAudience" is not boolean which may lead to unexpected results.',
        );
    });

    test('should log an error message and track an event if an audience evaluation timeout', async () => {
        const evaluator = createEvaluatorMock();
        const tracker = createTrackerMock();
        const logger = createLoggerMock();

        evaluator.evaluate = jest.fn().mockRejectedValue(new EvaluationError({
            type: EvaluationErrorType.TIMEOUT,
            title: 'Timeout reached.',
            status: 408,
            detail: 'The evaluation took more than 800ms to complete.',
        }));

        tracker.track = jest.fn().mockResolvedValue(undefined);

        const extension = new AudiencesExtension(
            {
                map: {
                    fooAudience: 'foo',
                },
            },
            evaluator,
            tracker,
            logger,
        );

        const variables = extension.getVariables();

        await expect(variables.fooAudience()).resolves.toBe(false);

        const event = {
            name: 'audienceTimeout',
            audience: 'fooAudience',
            details: {
                expression: 'foo',
                errorType: EvaluationErrorType.TIMEOUT,
                errorTitle: 'Timeout reached.',
                errorDetail: 'The evaluation took more than 800ms to complete.',
            },
        };

        expect(tracker.track).toHaveBeenCalledWith('eventOccurred', event);
        expect(logger.error).toHaveBeenCalledWith('Evaluation of audience "fooAudience" failed: timeout reached.');
    });

    test('should log an error message if the audience evaluation timeout and the event cannot be tracked', async () => {
        const evaluator = createEvaluatorMock();
        const tracker = createTrackerMock();
        const logger = createLoggerMock();

        evaluator.evaluate = jest.fn().mockRejectedValue(new EvaluationError({
            type: EvaluationErrorType.TIMEOUT,
            title: 'Timeout reached.',
            status: 408,
            detail: 'The evaluation took more than 800ms to complete.',
        }));

        tracker.track = jest.fn().mockRejectedValue(undefined);

        const extension = new AudiencesExtension(
            {
                map: {
                    fooAudience: 'foo',
                },
            },
            evaluator,
            tracker,
            logger,
        );

        const variables = extension.getVariables();

        await expect(variables.fooAudience()).resolves.toBe(false);

        expect(tracker.track).toHaveBeenCalledWith('eventOccurred', expect.anything());
        expect(logger.debug).toHaveBeenCalledWith('Failed to log audience evaluation error "Timeout reached."');
    });
});
