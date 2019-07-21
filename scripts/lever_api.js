import _ from 'lodash';
import fetch from 'node-fetch';
import buildUrl from 'build-url';

const LEVER_API = 'https://api.lever.co/v1';

export default class LeverApi {
  constructor(auth) {
    this.auth = auth;
  }

  async fetchLeverData(apiUrl) {
    return fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8;',
        Authorization: `Basic ${this.auth}`,
      },
    })
      .then(res => res.json())
      .catch((err) => {
        console.error(err);
      });
  }

  async fetchStagesMap() {
    const LIST_STAGES = 'https://api.lever.co/v1/stages';

    return this.fetchLeverData(LIST_STAGES)
      .then(({ data }) => _.reduce(data, (stagesMap, stage) => {
        stagesMap[stage.id] = stage.text;
        return stagesMap;
      }, {}));
  }

  async fetchCandidatesUpdatedSinceTimestamp({ postingId, archivedPostingId, timestamp }) {
    let candidates = [];
    let next = null;
    let hasNext = true;
    while (hasNext) {
      const listCandidatesUrl = buildUrl(LEVER_API, {
        path: 'candidates',
        queryParams: {
          expand: 'owner',
          posting_id: postingId || '',
          archived_posting_id: archivedPostingId || '',
          updated_at_start: timestamp,
          offset: next || '',
        },
      });
      console.log(listCandidatesUrl);
      // Block inside this loop since this makes an API call.
      // eslint-disable-next-line no-await-in-loop
      const response = await this.fetchLeverData(listCandidatesUrl);
      const { data } = response;
      candidates = [
        ...candidates,
        ...data,
      ];

      ({ hasNext, next } = response);
    }
    return candidates;
  }
}
