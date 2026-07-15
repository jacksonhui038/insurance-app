var fs = require('fs');
var line = fs.readFileSync('_test_block2.js', 'utf8').split('\n')[2290];
line = line.trim();
console.log('Line length:', line.length);
console.log('Parens:  (=' + (line.match(/\(/g) || []).length + ' )=' + (line.match(/\)/g) || []).length);
console.log('Bracket: [=' + (line.match(/\[/g) || []).length + ' ]=' + (line.match(/\]/g) || []).length);
console.log('Braces:  {=' + (line.match(/{/g) || []).length + ' }=' + (line.match(/}/g) || []).length);
