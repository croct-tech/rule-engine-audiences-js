import {Logger} from '@croct/plug/sdk';
import {Evaluator} from '@croct/plug/sdk/evaluation';
import {Tracker} from '@croct/plug/sdk/tracking';

export function createLoggerMock(): Logger {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
}

export function createEvaluatorMock(): Evaluator {
    const {
        Evaluator: EvaluatorMock,
    } = jest.genMockFromModule<{Evaluator: {new(): Evaluator}}>('@croct/plug/sdk/evaluation');

    return new EvaluatorMock();
}

export function createTrackerMock(): Tracker {
    const {
        Tracker: TrackerMock,
    } = jest.genMockFromModule<{Tracker: {new(): Tracker}}>('@croct/plug/sdk/tracking');

    return new TrackerMock();
}
