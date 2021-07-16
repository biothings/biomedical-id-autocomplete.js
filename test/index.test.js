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
        console.log(JSON.stringify(data));
        expect(JSON.stringify(data)).toContain('2561');
        expect(JSON.stringify(data)).toContain('ENSG00000121966');
    })
})

test('parse gene response', async () => {
    const data = await main.construct_single_query('Gene', 'CXCR4');
    const res = main.parse_single_response(data)['Gene'];
    expect(JSON.stringify(res)).toContain('CXCR4');
    for (let result of res) {
        if (result['SYMBOL'] === 'CXCR4') {
            expect(result['SYMBOL']).toBe('CXCR4');
            expect(result['ENSEMBL']).toBe('ENSG00000121966');
            expect(result['NCBIGene']).toBe('7852');
            expect(result['primary']['identifier']).toBe('NCBIGene');
        }
    }
    
})


test('test autocomplete with id', async () => {
    const res = await main.autocomplete('MONDO:0005737');
    expect(res.Disease.length).toBeGreaterThan(0);
})

test('test autocomplete with "multiple sclerosis"', async () => {
    const res = await main.autocomplete('multiple sclerosis');
    expect(res.Disease.length).toBeGreaterThan(0);
})

