const ID_RESOLVING_APIS = require('./config').ID_RESOLVING_APIS;

/**
 * Update the primary ID from id options
 * @param {string} semantic_type - The semantic type of IDs
 * @param {object} id_dict - An object of id representation
 * @returns - an id_dict updated with primary id choices
 */
function get_primary_id(semantic_type, id_dict) {
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


exports.get_primary_id = get_primary_id;
