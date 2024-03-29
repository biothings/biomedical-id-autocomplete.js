const axios = require('axios');
const { CURIE } = require('./config');
const _ = require('lodash');

//convert object of arrays into array of unique IDs
function combineInputs(userInput) {
  let result = Object.keys(userInput).reduce(function (r, k) {
    return r.concat(userInput[k]);
  }, []);
  return [...new Set(result)];
}

//input: array of curies
//handles querying and batching of inputs
async function query(api_input) {
  let url = 'https://nodenormalization-sri.renci.org/1.2/get_normalized_nodes';

  let chunked_input = _.chunk(api_input, 5000);
  try {
    const userAgent = `BTE/${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'} Node/${process.version} ${
      process.platform
    }`;
    let axios_queries = chunked_input.map((input) => {
      return axios.post(url, { curies: input }, { headers: { 'User-Agent': userAgent } });
    });
    //convert res array into single object with all curies
    let res = await Promise.all(axios_queries);
    res = res.map((r, i) => {
      return Object.keys(r.data).length ? r.data : Object.fromEntries(chunked_input[i].map((curie) => [curie, null]));
    });
    return Object.assign({}, ...res);
  } catch (err) {
    err.message = `SRI resolver failed: ${err.message}`;
    throw err;
  }
}

//build id resolution object for curies that couldn't be resolved
function UnresolvableEntry(curie, semanticType) {
  let id_type = curie.split(':')[0];
  return {
    id: {
      identifier: curie,
      label: curie,
    },
    equivalent_identifiers: [
      {
        identifier: curie,
        label: curie,
      },
    ],
    primaryID: curie,
    label: curie,
    curies: [curie],
    attributes: {},
    semanticType: semanticType,
    _leafSemanticType: semanticType,
    type: [semanticType],
    semanticTypes: [semanticType],
    dbIDs: {
      [id_type]: [CURIE.ALWAYS_PREFIXED.includes(id_type) ? curie : curie.split(':')[1]],
      name: [curie],
    },
    _dbIDs: {
      [id_type]: [CURIE.ALWAYS_PREFIXED.includes(id_type) ? curie : curie.split(':')[1]],
      name: [curie],
    },
  };
}

//build id resolution object for curies that were successfully resolved by SRI
function ResolvableEntry(SRIEntry) {
  let entry = SRIEntry;

  //add fields included in biomedical-id-resolver
  entry.primaryID = entry.id.identifier;
  entry.label = entry.id.label || entry.id.identifier;
  entry.attributes = {};
  entry.semanticType = entry.type[0].split(':')[1]; // get first semantic type without biolink prefix
  entry._leafSemanticType = entry.semanticType;
  entry.semanticTypes = entry.type;

  let names = Array.from(new Set(entry.equivalent_identifiers.map((id_obj) => id_obj.label))).filter((x) => x != null);
  let curies = Array.from(new Set(entry.equivalent_identifiers.map((id_obj) => id_obj.identifier))).filter(
    (x) => x != null,
  );

  entry.curies = [...curies];

  //assemble dbIDs
  entry.dbIDs = {};
  entry.equivalent_identifiers.forEach((id_obj) => {
    let id_type = id_obj.identifier.split(':')[0];
    if (!Array.isArray(entry.dbIDs[id_type])) {
      entry.dbIDs[id_type] = [];
    }

    if (CURIE.ALWAYS_PREFIXED.includes(id_type)) {
      entry.dbIDs[id_type].push(id_obj.identifier);
    } else {
      let curie_without_prefix = id_obj.identifier.split(':')[1];
      entry.dbIDs[id_type].push(curie_without_prefix);
    }
  });
  entry.dbIDs.name = names;
  entry._dbIDs = entry.dbIDs;
  return entry;
}

//transform output from SRI into original resolver shape
function transformResults(results) {
  //forEach does not wait for async calls
  for (let i = 0; i < Object.keys(results).length; i++) {
    const key = Object.keys(results)[i];
    let entry = results[key];
    if (entry === null) {
      //handle unresolvable entities
      entry = UnresolvableEntry(key, null);
    } else {
      entry = ResolvableEntry(entry);
    }
    results[key] = [entry];
  }
  return results;
}

//add entries with original semantic types if they don't match the SRI resolved types
function mapInputSemanticTypes(originalInput, result) {
  Object.keys(originalInput).forEach((semanticType) => {
    if (semanticType === 'unknown' || semanticType === 'undefined' || semanticType === 'NamedThing') {
      //rely on SRI type if input is unknown, undefined, or NamedThing
      return;
    }

    let uniqueInputs = [...new Set(originalInput[semanticType])];
    uniqueInputs.forEach((curie) => {
      let entry = result[curie][0];
      if (!entry.semanticType) {
        entry._leafSemanticType = semanticType;
        entry.semanticType = semanticType;
        entry.semanticTypes = [semanticType];
        entry.type = [semanticType];
      } else if (entry.semanticType !== semanticType) {
        //add entry if SRI semantic type doesn't match input semantic type
        debug(
          `SRI resolved type '${entry.semanticType}' doesn't match input semantic type '${semanticType}' for curie '${entry.primaryID}'. Adding entry for '${semanticType}'.`,
        );
        let new_entry = _.cloneDeep(entry);

        new_entry._leafSemanticType = semanticType;
        new_entry.semanticType = semanticType;
        new_entry.semanticTypes[0] = semanticType;
        new_entry.type[0] = semanticType;

        result[curie].push(new_entry);
      }
    });
  });

  return result;
}

async function _resolveSRI(userInput) {
  let uniqueInputIDs = combineInputs(userInput);

  let queryResults = await query(uniqueInputIDs);

  queryResults = transformResults(queryResults);

  queryResults = mapInputSemanticTypes(userInput, queryResults);

  return queryResults;
}

exports.resolveSRI = _resolveSRI;