const fs=require('fs');
let code=fs.readFileSync('lib/registry.ts','utf8');
const sIdx=code.indexOf('const seedProducts: Product[] = [');
let eIdx=code.indexOf('      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(seedProducts));',sIdx);
if(eIdx!==-1){
  const block=code.substring(sIdx,eIdx);
  code=code.substring(0,sIdx)+'/* replaced */'+code.substring(eIdx);
  const iIdx=code.indexOf('export const RegistryManager = {');
  const exp=block.replace('const seedProducts: Product[] =','export const seedProducts: Product[] =');
  code=code.substring(0,iIdx)+exp+'\n\n'+code.substring(iIdx);
  code=code.replace('/* replaced */','localStorage.setItem(\'seed_init_flag\', \'true\');');
  fs.writeFileSync('lib/registry.ts',code);
  console.log('Success');
}else{
  console.log('Failed to find end');
}
