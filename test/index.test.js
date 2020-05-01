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

