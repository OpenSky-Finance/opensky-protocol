import fs from 'fs';

import { makeSuite } from './helpers/make-suite';
import { executeStory } from './helpers/scenario-engine';

const scenarioFolder = './scripts/test/helpers/scenarios/';
const selectedScenarios: string[] = []; //"borrow-repay-stable-edge.json", "borrow-repay-stable.json"];

fs.readdirSync(scenarioFolder).forEach((file) => {
    if (selectedScenarios.length > 0 && !selectedScenarios.includes(file)) return;
    const scenario = require(`./helpers/scenarios/${file}`);
    // console.log(`scenario ${file}`)

    makeSuite(scenario.title, async (testEnv) => {
        for (const story of scenario.stories) {
            it(story.description, async function () {
                // console.log('executeStory', story.description)

                await executeStory(story, testEnv);
            });
        }
    });
});
