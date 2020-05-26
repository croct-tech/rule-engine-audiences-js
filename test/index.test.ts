import engine from '@croct/plug-rule-engine/plugin';
import {ExtensionFactory} from '@croct/plug-rule-engine/extension';
import {PluginSdk} from '@croct/plug/plugin';
import {createEvaluatorMock, createLoggerMock, createTrackerMock} from './mocks';
import AudiencesExtension from '../src/extension';
import '../src/index';

jest.mock('@croct/plug-rule-engine/plugin', () => ({
    default: {
        extend: jest.fn(),
    },
    __esModule: true,
}));

jest.mock('../src/extension', () => {
    const actual = jest.requireActual('../src/extension');

    return {
        ...actual,
        default: jest.fn(),
        __esModule: true,
    };
});

describe('An audience extension installer', () => {
    test('should register the extension', () => {
        expect(engine.extend).toBeCalledWith('audiences', expect.anything());

        const [, factory]: [string, ExtensionFactory] = (engine.extend as jest.Mock).mock.calls[0];

        const tracker = createTrackerMock();
        const evaluator = createEvaluatorMock();
        const logger = createLoggerMock();

        const sdk: Partial<PluginSdk> = {
            evaluator: evaluator,
            tracker: tracker,
            getLogger: () => logger,
        };

        const definitions = {
            map: {
                foo: 'fooAudience',
                bar: {
                    expression: 'bar',
                },
            },
        };

        factory({options: definitions, sdk: sdk as PluginSdk});

        expect(AudiencesExtension).toBeCalledTimes(1);

        expect(AudiencesExtension).toBeCalledWith(
            definitions,
            evaluator,
            tracker,
            logger,
        );
    });

    test.each<[any, string]>([
        [
            null,
            "Expected value of type object at path '/', actual null.",
        ],
        [
            {},
            "Missing property '/map'.",
        ],
        [
            {
                map: {
                    '': 'bar',
                },
            },
            "Expected at least 1 character at path '/map/', actual 0.",
        ],
        [
            {
                map: {
                    foo: '',
                },
            },
            "Expected at least 1 character at path '/map/foo', actual 0.",
        ],
        [
            {
                map: {
                    foo: {},
                },
            },
            "Missing property '/map/foo/expression'.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: null,
                    },
                },
            },
            "Expected value of type string or object at path '/map/foo/expression', actual null.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: '',
                    },
                },
            },
            "Expected at least 1 character at path '/map/foo/expression', actual 0.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: {
                            subexpressions: [],
                        },
                    },
                },
            },
            "Missing property '/map/foo/expression/conjunction'.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: {
                            conjunction: 'and',
                        },
                    },
                },
            },
            "Missing property '/map/foo/expression/subexpressions'.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: {
                            conjunction: 1,
                            subexpressions: [],
                        },
                    },
                },
            },
            "Expected value of type string at path '/map/foo/expression/conjunction', actual integer.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: {
                            conjunction: 'bar',
                            subexpressions: [],
                        },
                    },
                },
            },
            "Unexpected value at path '/map/foo/expression/conjunction', expecting 'and' or 'or', found 'bar'.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: {
                            conjunction: 'and',
                            subexpressions: [1],
                        },
                    },
                },
            },
            "Expected value of type string at path '/map/foo/expression/subexpressions/0', actual integer.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: {
                            conjunction: 'and',
                            subexpressions: [''],
                        },
                    },
                },
            },
            "Expected at least 1 character at path '/map/foo/expression/subexpressions/0', actual 0.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                        options: {
                            timeout: '1',
                        },
                    },
                },
            },
            "Expected value of type integer at path '/map/foo/options/timeout', actual string.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                        options: {
                            timeout: 1.2,
                        },
                    },
                },
            },
            "Expected value of type integer at path '/map/foo/options/timeout', actual number.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                        options: {
                            timeout: 99,
                        },
                    },
                },
            },
            "Expected a value greater than or equal to 100 at path '/map/foo/options/timeout', actual 99.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                        options: {
                            attributes: 'something',
                        },
                    },
                },
            },
            "Expected a JSON object at path '/map/foo/options/attributes', actual string.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                    },
                },
                defaultOptions: {
                    timeout: '1',
                },
            },
            "Expected value of type integer at path '/defaultOptions/timeout', actual string.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                    },
                },
                defaultOptions: {
                    timeout: 1.2,
                },
            },
            "Expected value of type integer at path '/defaultOptions/timeout', actual number.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                    },
                },
                defaultOptions: {
                    timeout: 99,
                },
            },
            "Expected a value greater than or equal to 100 at path '/defaultOptions/timeout', actual 99.",
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                    },
                },
                defaultOptions: {
                    attributes: 'something',
                },
            },
            "Expected a JSON object at path '/defaultOptions/attributes', actual string.",
        ],
    ])('should reject definitions %p', (definitions: any, error: string) => {
        const [, factory]: [string, ExtensionFactory] = (engine.extend as jest.Mock).mock.calls[0];

        const sdk: Partial<PluginSdk> = {
            tracker: createTrackerMock(),
            getLogger: () => createLoggerMock(),
            getBrowserStorage: () => window.localStorage,
            getTabStorage: () => window.sessionStorage,
        };

        function create(): void {
            factory({options: definitions, sdk: sdk as PluginSdk});
        }

        expect(create).toThrow(error);
    });

    test.each<[any]>([
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                    },
                },
            },
        ],
        [
            {
                map: {
                    foo: {
                        expression: {
                            conjunction: 'and',
                            subexpressions: ['bar', 'baz'],
                        },
                    },
                },
            },
        ],
        [
            {
                map: {
                    foo: {
                        expression: 'bar',
                        options: {
                            timeout: 200,
                            attributes: {something: 'someValue'},
                        },
                    },
                },
                defaultOptions: {
                    timeout: 200,
                    attributes: {something: 'anotherValue'},
                },
            },
        ],
    ])('should accept definition %p', (definitions: any) => {
        const [, factory]: [string, ExtensionFactory] = (engine.extend as jest.Mock).mock.calls[0];

        const sdk: Partial<PluginSdk> = {
            tracker: createTrackerMock(),
            getLogger: () => createLoggerMock(),
            getBrowserStorage: () => window.localStorage,
            getTabStorage: () => window.sessionStorage,
        };

        function create(): void {
            factory({options: definitions, sdk: sdk as PluginSdk});
        }

        expect(create).not.toThrowError();
    });
});
