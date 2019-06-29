import Coda from 'coda-js';
import _ from 'lodash';
import minimist from 'minimist';
import LeverApi from './lever_api';

// Command line arguments
const args = minimist(process.argv.slice(2));
const {
    // Lever
    l: leverAuth,
    p: postingIdsCommaSperated,
    t: timestamp,
    // Coda
    c: codaAuth,
    d: docId,
    g: tableId,
} = args;

async function main() {
    const lever = new LeverApi(leverAuth);

    const stagesMap = await lever.fetchStagesMap();
    const postingIds = postingIdsCommaSperated.split(',');
    const fetchPromises = [];
    _.forEach(postingIds, (pid) => {
        fetchPromises.push(lever.fetchCandidates(pid, timestamp));
    });
    const results = await Promise.all(fetchPromises);

    const leverCandidates = [];
    _.forEach(results, (candidates) => {
        leverCandidates.push(...candidates);
    });

    const flatCandidates = _.map(leverCandidates, c => ({
        name: c.name,
        id: c.id,
        origin: c.origin,
        sources: c.sources.join(','),
        owner: c.owner.name,
        created: new Date(c.createdAt),
        advanced: new Date(c.lastAdvancedAt),
        'last interaction': new Date(c.lastInteractionAt),
        stage: stagesMap[c.stage],
        url: c.urls.show,
    }));

    console.log(`Found ${leverCandidates.length} candidates`);

    if (flatCandidates.length > 0) {
        const coda = new Coda(codaAuth);
        const doc = await coda.getDoc(docId);
        const table = await doc.getTable(tableId);
        const keyColumns = ['id'];
        const upsertPromises = [];
        _.forEach(_.chunk(flatCandidates, 100), (chunk) => {
            upsertPromises.push(table.insertRows(chunk, keyColumns));
        });
        await Promise.all(upsertPromises);
    }
}

main();
