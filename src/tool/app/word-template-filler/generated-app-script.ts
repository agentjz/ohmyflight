// 生成应用的运行时脚本聚合器

import { GeneratedAppRuntimeBatch } from "./generated-app-runtime-batch";
import { GeneratedAppRuntimeDate } from "./generated-app-runtime-date";
import { GeneratedAppRuntimeEvents } from "./generated-app-runtime-events";
import { GeneratedAppRuntimeExport } from "./generated-app-runtime-export";
import { GeneratedAppRuntimeForm } from "./generated-app-runtime-form";
import { GeneratedAppRuntimeLoop } from "./generated-app-runtime-loop";
import { GeneratedAppRuntimeState } from "./generated-app-runtime-state";
import { GeneratedAppRuntimeTemplate } from "./generated-app-runtime-template";
import type { WordTemplateAppConfig } from "./models";

export const GeneratedAppScript = {
    generate: (config: WordTemplateAppConfig, templateFileName: string): string => {
        const fieldsJson = JSON.stringify(config.fields);
        const loopFieldsJson = JSON.stringify(config.loopFields);

        return [
            GeneratedAppRuntimeState.generate(fieldsJson, loopFieldsJson, templateFileName),
            GeneratedAppRuntimeTemplate.generate(),
            GeneratedAppRuntimeLoop.generate(),
            GeneratedAppRuntimeForm.generate(),
            GeneratedAppRuntimeDate.generate(),
            GeneratedAppRuntimeBatch.generate(),
            GeneratedAppRuntimeExport.generate(),
            GeneratedAppRuntimeEvents.generate()
        ].join('\n');
    }
};
