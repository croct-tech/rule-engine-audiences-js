import engine from '@croct/plug-rule-engine/plugin';
import {PluginArguments} from '@croct/plug/plugin';
import AudiencesExtension, {Options} from './extension';
import {optionsSchema} from './schemas';

declare module '@croct/plug-rule-engine/plugin' {
    export interface ExtensionConfigurations {
        audiences?: Options | false;
    }
}

declare module '@croct/plug-rule-engine/rule' {
    export interface RuleProperties {
        audience?: string;
    }
}

engine.extend('audiences', ({options, sdk}: PluginArguments<Options>) => {
    optionsSchema.validate(options);

    return new AudiencesExtension(options, sdk.evaluator, sdk.tracker, sdk.getLogger());
});
