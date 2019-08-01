import Coda from 'coda-js';
import _ from 'lodash';
import minimist from 'minimist';
import LeverApi from './lever_api';

// Command line arguments
const args = minimist(process.argv.slice(2));

const HOUR_IN_MS = 3600000;
const UPSERT_CHUNK_SIZE = 100;

async function main() {
  const {
    // Lever
    lever_auth: leverAuth,
    created_timestamp: createdTimestamp,
    hours_since_updated: hoursSinceUpdated,
    // Coda
    coda_auth: codaAuth,
    doc_id: docId,
  } = args;

  const lever = new LeverApi(leverAuth);
  const coda = new Coda(codaAuth);
  const doc = await coda.getDoc(docId);

  const postingsTable = await doc.getTable('Postings');
  const rows = await postingsTable.listRows({ useColumnNames: true });
  const postingIds = _.map(rows, 'values.id');

  const stagesMap = await lever.fetchStagesMap();

  // Clean this up, but --created_timestamp is good for back filling
  // and --hours_since_updated is good for a scheduled update
  const timestamp = createdTimestamp || Date.now() - hoursSinceUpdated * HOUR_IN_MS;
  const fetchPromises = [];
  _.forEach(postingIds, (postingId) => {
    fetchPromises.push(lever.fetchCandidatesUpdatedSinceTimestamp({ postingId, timestamp }));
    fetchPromises.push(lever.fetchCandidatesUpdatedSinceTimestamp({ archivedPostingId: postingId, timestamp }));
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

  const candidates = _.uniqBy(flatCandidates, 'id');
  console.log(`Found ${candidates.length} unique candidates`);

  if (candidates.length > 0) {
    const candidatesTable = await doc.getTable('Candidates');
    const keyColumns = ['id'];
    const upsertPromises = [];
    _.forEach(_.chunk(candidates, UPSERT_CHUNK_SIZE), (chunk) => {
      upsertPromises.push(candidatesTable.insertRows(chunk, keyColumns));
    });
    await Promise.all(upsertPromises);
  }
}

main();
