const main = require('../index');

const id_dict = {
    "NCBIGene": "7852", 
    "name": "C-X-C motif chemokine receptor 4", 
    "SYMBOL": "CXCR4", 
    "UMLS": "C1332823", 
    "HGNC": "2561", 
    "UNIPROTKB": "P61073", 
    "ENSEMBL": "ENSG00000121966"
}

test('get primary id', () => {
    let res = main.get_primary_id("Gene", id_dict);
    expect(res['identifier']).toBe('NCBIGene');
    expect(res['cls']).toBe('Gene');
    expect(res['value']).toBe("7852")
});