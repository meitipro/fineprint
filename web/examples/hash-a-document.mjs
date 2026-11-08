/**
 * Compute the id of a document in the browser or in Node, with no wallet and no network.
 *
 *   node examples/hash-a-document.mjs
 *
 * This is the same file the site runs (lib/hash.mjs), held byte for byte to the
 * contract's own hash by tests/vectors.json. The sample on the docs page "Hashing".
 */
import { docIdOf } from '../lib/hash.mjs';

const id = docIdOf('Kiln airdrop terms', [
  'Hold 100 KILN at the Oct 1 snapshot.',
  'Wallets created later are not eligible.',
  'Claims close on Dec 15.',
]);
console.log(id);
