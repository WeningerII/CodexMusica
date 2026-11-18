// Objective English accentual realizations. Other uses of a role name can
// require literary or performance evidence beyond a printed lexical reading.
const endings = new Map([
  ['stressed-ending', '/'],
  ['unstressed-ending', '.'],
  ['masculine-ending', '/'],
  ['feminine-ending', '/.'],
]);

export function stressEndingFor(role) {
  return endings.get(role);
}

// An exact iambic hexameter offers one regular English alexandrine setting.
export const regularAlexandrine = './'.repeat(6);

// A catalog refrain role can be tested when the same whole line is prescribed
// at positions in two different divisions. Repetition inside one local passage
// alone does not establish its function as a structural refrain.
export function refrainAddresses(tree) {
  const groups = new Map();
  function visit(node, division) {
    if (node.unit === 'section' || node.unit === 'stanza') division = node.address;
    if (node.unit === 'line' && node.returns && division) {
      if (!groups.has(node.returns)) groups.set(node.returns, []);
      groups.get(node.returns).push({ division, address: node.address, role: node.role });
    }
    node.children.forEach((child) => visit(child, division));
  }
  tree.forEach((node) => visit(node));
  const result = new Set();
  for (const group of groups.values()) {
    if (new Set(group.map((item) => item.division)).size < 2) continue;
    for (const item of group) if (item.role === 'refrain') result.add(item.address);
  }
  return result;
}
