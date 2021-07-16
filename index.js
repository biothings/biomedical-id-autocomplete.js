const ID_RESOLVING_APIS = require('./config').ID_RESOLVING_APIS;
const axios = require('axios');

/**
 * Update the primary ID from id options
 * @param {string} semantic_type - The semantic type of IDs
 * @param {object} id_dict - An object of id representation
 * @returns - an id_dict updated with primary id choices
 */
exports.get_primary_id = (semantic_type, id_dict) => {
    let ranks = ID_RESOLVING_APIS[semantic_type]["id_ranks"];
    let res = {};
    for (let index = 0; index < ranks.length; index++) {
        if (ranks[index] in id_dict) {
            res = {
                identifier: ranks[index],
                cls: semantic_type,
                value: id_dict[ranks[index]]
            };
            return res;
        }
    }
}

/**
 * Update the display message from id options
 * @param {string} semantic_type - The semantic type of IDs
 * @param {object} id_dict - An object of id representation
 * @returns - an id_dict updated with primary id choices
 */
exports.get_display_message = (semantic_type, id_dict) => {
    let ranks = ID_RESOLVING_APIS[semantic_type]["id_ranks"];
    let res = '';
    for (let index = 0; index < ranks.length; index++) {
        if (ranks[index] in id_dict) {
            res += (ranks[index] + '(' + id_dict[ranks[index]] + ') ');
        }
    }
    return res.replace(/^\s+|\s+$/g, '');
}

/**
 * Get the fields to perform API query
 * @param {string} semantic_type - The semantic type of IDs
 * @returns - query field
 */
exports.get_query_fields = (semantic_type) => {
    let mapping = ID_RESOLVING_APIS[semantic_type]["mapping"];
    let fields = [];
    const field_values = Object.values(mapping);
    for (let index = 0; index < field_values.length; index++) {
        fields = fields.concat(field_values[index]);
    };
    return fields.sort().join(',')
}

// exports.construct_q = (input, query_fields) => {
//     let res = '';
//     query_fields.split(',').map(field => {
//         res = `${res}${field}:"${input.toString()}*" OR `;
//     })
//     return res.slice(0, -5);
// }

//wide - whether or not to match wider results with a *
exports.construct_single_query = (semantic_type, input, wide=false) => {
    const base_url = ID_RESOLVING_APIS[semantic_type]["url"] + '/query';
    let query_fields;
    if (ID_RESOLVING_APIS[semantic_type]["api_name"] === "geneset API") {
        query_fields = 'go,umls,name,reactome,wikipathways,kegg,pharmgkb,type';
    } else {
        query_fields = this.get_query_fields(semantic_type);
    }

    return axios({
        method: 'get',
        url: base_url,
        params: {
            q: wide ? `${input}*` : `"${input}"`,
            // q: this.construct_q(input, query_fields),
            fields: query_fields,
            species: 'human',
            dotfield: true
        },
        timeout: 3000,
        type: semantic_type
    }).catch(err => console.warn(err));
}

exports.make_queries = (input, wide=false) => {
    let semantic_types = Object.keys(ID_RESOLVING_APIS);
    let queries = [];
    for (const semantic_type of semantic_types) {
        if (semantic_type in ['BiologicalProcess', 'Pathway', 'CellularComponent']) {
            continue;
        }
        queries.push(this.construct_single_query(semantic_type, input, wide))
    };
    return axios.all(queries);
}

exports.parse_single_response = (response) => {
    const TYPE_MAPPING = {
        "bp": "BiologicalProcess",
        "pathway": "Pathway",
        "cc": "CellularComponent",
        "mf": "MolecularActivity"
    }
    let semantic_type = response['config']['type'];
    let result = {};
    for (let res of response.data.hits) {
        let tmp = {};
        if (res['type'] in TYPE_MAPPING) {
            semantic_type = TYPE_MAPPING[res['type']];
        }
        const mapping = ID_RESOLVING_APIS[semantic_type]["mapping"];
        for (let id_type of Object.keys(mapping)) {
            for (let field of mapping[id_type]) {
                if (field in res) {
                    let val = res[field];
                    if (Array.isArray(val)) {
                        tmp[id_type] = val[0];
                    } else {
                        tmp[id_type] = val;
                    }
                    break;
                }
            }
        }
        tmp['_score'] = res._score;
        tmp['primary'] = this.get_primary_id(semantic_type, tmp);
        tmp['display'] = this.get_display_message(semantic_type, tmp);
        tmp['type'] = semantic_type;
        if (!(semantic_type in result)) {
            result[semantic_type] = [];
        }
        result[semantic_type].push(tmp);
    }
    return result;
}

exports.autocomplete = async (input) => {
    let responses = [];

    //attempt to get exact matches first
    try {
        responses = await this.make_queries(input, false);
    } catch (e) {
        console.warn(e);
    }

    //if there are no results attempt wider matching
    let response_empty = true;
    for (let res of responses) {
        if (res.data.total > 0) {
            response_empty = false;
            break;
        }
    } 
    if (response_empty) {
        try {
            responses = await this.make_queries(input, true);
        } catch (e) {
            console.warn(e);
        }
    }

    let result = {};
    for (let res of responses) {
        if (res) {
            result = Object.assign(result, this.parse_single_response(res));
        }
    };
    for (const semantic_type of Object.keys(ID_RESOLVING_APIS)) {
        if (!(semantic_type in result)) {
            result[semantic_type] = [];
        }
    }
    return result;
}

