import {Rule, Predicate} from '../../src';

import Extension, {AudienceDefinition} from '../../src/ext/audience/audienceMatcher';
import {Context} from '../../src/context';
import {MockContainer} from '../mock/mockContainer';

beforeEach(() => {
    jest.restoreAllMocks();
});

describe('An audience matcher extension', () => {
    test('should have a name', async () => {
        const extensionFactory = Extension.initialize({fooAudience: 'foo'});

        expect(extensionFactory.getExtensionName()).toBe(Extension.name);
    });

    test('should provide a predicate for a given audience name', async () => {
        const extensionFactory = Extension.initialize({fooAudience: 'foo'});
        const extension = extensionFactory.create(new MockContainer());

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

    test('should not provide a predicate if the audience name is not specified', () => {
        const extensionFactory = Extension.initialize({fooAudience: {expression: 'foo'}});
        const extension = extensionFactory.create(new MockContainer());

        const rule: Rule = {
            name: 'foo',
            properties: {},
        };

        expect(extension.getPredicate(rule)).toBeNull();
    });

    test('should fail if the audience name is not a string', () => {
        const extensionFactory = Extension.initialize({fooAudience: 'foo'});
        const extension = extensionFactory.create(new MockContainer());

        const rule: Rule = {
            name: 'foo',
            properties: {audience: 1},
        };

        function getPredicate(): void {
            extension.getPredicate(rule);
        }

        expect(getPredicate).toThrow(
            'Invalid audience specified for rule "foo", expected string but got number.',
        );
    });

    test('should fail if the specified audience does not exist', () => {
        const extensionFactory = Extension.initialize({fooAudience: 'foo'});
        const extension = extensionFactory.create(new MockContainer());

        const rule: Rule = {
            name: 'foo',
            properties: {audience: 'barAudience'},
        };

        function getPredicate(): void {
            extension.getPredicate(rule);
        }

        expect(getPredicate).toThrow('Audience "barAudience" does not exist.');
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
            const extensionFactory = Extension.initialize({[audience]: definition});

            const container = new MockContainer();
            const evaluator = container.getEvaluator();
            evaluator.evaluate = jest.fn().mockResolvedValue(true);

            const extension = extensionFactory.create(container);

            const variables = extension.getVariables();

            await expect(variables[audience]()).resolves.toBe(true);

            expect(evaluator.evaluate).toHaveBeenCalledWith(expression);
        },
    );

    test('should evaluate the audience expression with the specified options', async () => {
        const extensionFactory = Extension.initialize({
            fooAudience: {
                expression: 'foo',
                options: {
                    timeout: 10,
                },
            },
        });

        const container = new MockContainer();
        const evaluator = container.getEvaluator();
        evaluator.evaluate = jest.fn().mockResolvedValue(true);

        const extension = extensionFactory.create(container);

        const variables = extension.getVariables();

        await expect(variables.fooAudience()).resolves.toBe(true);

        expect(evaluator.evaluate).toHaveBeenCalledWith('foo', {timeout: 10});
    });

    test('should log a warn message if the definition specified for an audience is invalid', async () => {
        const extensionFactory = Extension.initialize({
            invalid: {
                expression: {
                    conjunction: 'or',
                    subexpressions: [],
                },
            },
        });

        const container = new MockContainer();
        const evaluator = container.getEvaluator();
        const logger = container.getLogger();

        evaluator.evaluate = jest.fn();

        const extension = extensionFactory.create(container);

        const variables = extension.getVariables();

        await expect(variables.invalid()).resolves.toBe(false);

        expect(evaluator.evaluate).not.toHaveBeenCalled();

        expect(logger.warn).toHaveBeenCalledWith(
            'Invalid expression definition specified for audience "invalid".',
        )
    });

    test('should log a warn message if the result of the audience evaluation is not boolean', async () => {
        const extensionFactory = Extension.initialize({fooAudience: 'foo'});

        const container = new MockContainer();
        const evaluator = container.getEvaluator();
        const logger = container.getLogger();

        evaluator.evaluate = jest.fn().mockResolvedValue('bar');

        const extension = extensionFactory.create(container);

        const variables = extension.getVariables();

        await expect(variables.fooAudience()).resolves.toBe(false);

        expect(logger.warn).toHaveBeenCalledWith(
            'The evaluation result for audience "fooAudience" is not a boolean '
            + 'which may lead to unexpected results.',
        )
    });

    test('should log an error message if the audience evaluation fails', async () => {
        const extensionFactory = Extension.initialize({fooAudience: 'foo'});

        const container = new MockContainer();
        const evaluator = container.getEvaluator();
        const logger = container.getLogger();

        evaluator.evaluate = jest.fn().mockRejectedValue(new Error('Evaluation failed.'));

        const extension = extensionFactory.create(container);

        const variables = extension.getVariables();

        await expect(variables.fooAudience()).resolves.toBe(false);

        expect(logger.error).toHaveBeenCalledWith('The evaluation of audience "fooAudience" failed.');
    });
});
