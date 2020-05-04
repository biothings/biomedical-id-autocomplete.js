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

test("get display message", () => {
    let res = main.get_display_message("Gene", id_dict);
    expect(res).toBe("NCBIGene(7852) ENSEMBL(ENSG00000121966) HGNC(2561) UMLS(C1332823) UNIPROTKB(P61073) SYMBOL(CXCR4)");
});

test('get query fields', () => {
    let res = main.get_query_fields("Gene");
    expect(res).toBe("HGNC,MGI,OMIM,ensembl.gene,entrezgene,name,symbol,umls.cui,umls.protein_cui,uniprot.Swiss-Prot")
})

test('get gene response', () => {
    return main.construct_single_query('Gene', 'CXCR4').then(data => {
        expect(data.data[0]['query']).toBe('CXCR4');
        expect(data.data[0]['HGNC']).toBe('2561');
        expect(data.data[0]['ensembl.gene']).toBe('ENSG00000121966');
    })
})

test('parse gene response', async () => {
    const data = await main.construct_single_query('Gene', 'CXCR4');
    const res = main.parse_single_response(data)['Gene'];
    expect(res[0]['SYMBOL']).toBe('CXCR4');
    expect(res[0]['ENSEMBL']).toBe('ENSG00000121966');
    expect(res[0]['NCBIGene']).toBe('7852');
    expect(res[0]['primary']['identifier']).toBe('NCBIGene');
})

