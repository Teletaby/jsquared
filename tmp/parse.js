const fs = require('fs');
const jsx = require('acorn-jsx');
const acorn = require('acorn');
const code = fs.readFileSync('c:/Users/rosen/Desktop/movie/j-squared-cinema/app/movie/[id]/page.tsx','utf8');
try{
  acorn.Parser.extend(jsx()).parse(code,{ecmaVersion:2020,sourceType:'module'});
  console.log('Parsed OK');
}catch(e){
  console.error('PARSE ERROR');
  console.error(e.message);
  if(e.loc) console.error('line',e.loc.line,'column',e.loc.column);
  process.exit(1);
}
