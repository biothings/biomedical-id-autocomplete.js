let autocomplete = require("./index");

(async () => {
    let res = await autocomplete.autocomplete("ebola");
    console.log(res);
} )();