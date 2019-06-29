import Coda from 'coda-js';
import _ from 'lodash';
import minimist from 'minimist';
import LeverApi from './lever_api';

// Command line arguments
const args = minimist(process.argv.slice(2));

async function main() {
  // Move from to descriptive arguments
  const {
    // Lever
    l: leverAuth,
    p: postingIdsCommaSperated,
    t: timest, // create since timestamp
    hours_since_updated: hoursSinceUpdated,
    // Coda
    c: codaAuth,
    d: docId,
    g: tableId,
  } = args;

  const lever = new LeverApi(leverAuth);
  // Clean this up, but --t is good for back filling and --hours_since_updated is good for scheduled updates
  const timestamp = timest || Date.now() - hoursSinceUpdated * 3600000;
  const stagesMap = await lever.fetchStagesMap();
  const postingIds = postingIdsCommaSperated.split(',');
  const fetchPromises = [];
  _.forEach(postingIds, (pid) => {
    fetchPromises.push(lever.fetchCandidatesUpdatedSinceTimestamp(pid, timestamp));
  });
  const results = await Promise.all(fetchPromises);

  const leverCandidates = [];
  _.forEach(results, (candidates) => {
    if (candidates) {
      leverCandidates.push(...candidates);
    }
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
