import _ from 'lodash';
import fetch from 'node-fetch';

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

  async fetchCandidatesUpdatedSinceTimestamp(postingId, timestamp) {
    const LIST_CANDIDATES = `https://api.lever.co/v1/candidates?expand=owner&posting_id=${postingId}&updated_at_start=${timestamp}`;
    //archived_posting_id
    let { data, hasNext, next } = await this.fetchLeverData(LIST_CANDIDATES);
    let candidates = data;
    while (hasNext) {
      const listCandidates = `${LIST_CANDIDATES}&offset=${next}`;
      // Block inside this loop since this makes an API call.
      // eslint-disable-next-line no-await-in-loop
      ({ data, hasNext, next } = await this.fetchLeverData(listCandidates));
      candidates = [
        ...candidates,
        ...data,
      ];
    }
    return candidates;
  }

  async fetchArchivedCandidatesUpdatedSinceTimestamp(postingId, timestamp) {
    const LIST_CANDIDATES = `https://api.lever.co/v1/candidates?expand=owner&archived_posting_id=${postingId}&updated_at_start=${timestamp}`;
    let { data, hasNext, next } = await this.fetchLeverData(LIST_CANDIDATES);
    let candidates = data;
    while (hasNext) {
      const listCandidates = `${LIST_CANDIDATES}&offset=${next}`;
      // Block inside this loop since this makes an API call.
      // eslint-disable-next-line no-await-in-loop
      ({ data, hasNext, next } = await this.fetchLeverData(listCandidates));
      candidates = [
        ...candidates,
        ...data,
      ];
    }
    return candidates;
  }
}
