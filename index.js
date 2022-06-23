const ID_RESOLVING_APIS = require('./config').ID_RESOLVING_APIS;
const axios = require('axios');
const { resolveSRI } = require('biomedical_id_resolver');

/**
 * Combines identifier and value into curie when values 
 * may or may not contain the identifier
 * @param {string} identifier 
 * @param {string} value 
 * @returns - string of curie
 */
exports.make_curie = (identifier, value) => {
    if (value.indexOf(':') === -1) {
        return identifier + ':' + value;
    } else {
        return value;
    }
}

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
                value: id_dict[ranks[index]],
                curie: this.make_curie(ranks[index], id_dict[ranks[index]])
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

    const fields_to_ignore = ['name', '_score', 'primary'];
    //sort the id_dict by index of key in ranks array with not found going last
    let sorted_id_dict = Object.keys(id_dict).filter(x => !fields_to_ignore.includes(x)).sort((a, b) => {
        let a_val = ranks.indexOf(a);
        if (a_val === -1) {
            a_val = ranks.length;
        }
        let b_val = ranks.indexOf(b);
        if (b_val === -1) {
            b_val = ranks.length;
        }
        return a_val - b_val;
    });

    return sorted_id_dict.map(x => {
        return this.make_curie(String(x), String(id_dict[x]));
    }).join(' ');
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
    //old semantic types, just used for populating info
    let semantic_type = response['config']['type'];
    let result = [];
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
        if (tmp['primary']) {
            result.push(tmp);
        }
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

    let result = [];
    for (let res of responses) {
        if (res) {
            result.push(...this.parse_single_response(res));
        }
    };

    let sri_input = {
        'undefined': result.map(obj => obj.primary.curie)
    }

    //apply semantic type to result using sri
    let sri_res = await resolveSRI(sri_input);

    for (let r of result) {
        let semantic_type = sri_res[r.primary.curie][0].semanticType;
        r.primary.type = semantic_type;
    }

    //sort by score
    return result.sort((a, b) => {
        return b._score - a._score;
    });
}

