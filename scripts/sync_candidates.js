import Coda from 'coda-js';
import _ from 'lodash';
import minimist from 'minimist';
import LeverApi from './lever_api';

// Command line arguments
const args = minimist(process.argv.slice(2));

async function main() {
  const {
    // Lever
    lever_auth: leverAuth,
    posting_ids: postingIdsCommaSperated,
    created_timestamp: createdTimestamp,
    hours_since_updated: hoursSinceUpdated,
    // Coda
    coda_auth: codaAuth,
    doc_id: docId,
    table_id: tableId,
  } = args;

  const lever = new LeverApi(leverAuth);

  const stagesMap = await lever.fetchStagesMap();

  // Clean this up, but --created_timestamp is good for back filling
  // and --hours_since_updated is good for a scheduled update
  const timestamp = createdTimestamp || Date.now() - hoursSinceUpdated * 3600000;
  const postingIds = postingIdsCommaSperated.split(',');
  const fetchPromises = [];
  _.forEach(postingIds, (pid) => {
    fetchPromises.push(lever.fetchCandidatesUpdatedSinceTimestamp(pid, timestamp));
    fetchPromises.push(lever.fetchArchivedCandidatesUpdatedSinceTimestamp(pid, timestamp));
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
    archived: _.get(c, 'archived.archivedAt') && new Date(c.archived.archivedAt),
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
