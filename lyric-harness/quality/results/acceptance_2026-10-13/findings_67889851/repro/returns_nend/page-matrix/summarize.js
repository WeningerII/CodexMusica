const r = require('./' + (process.argv[2] || 'matrix') + '.json');
const lines = ['id\tkind\tmain_row\trow_after_load\tnotice\twords(before->now)\teditor_label\tsent_to_chat\tchat_calls\tblocked_refusal\tboot_toast'];
for (const x of r) {
  const o = x.observed;
  const n = o.notices[0];
  const w = n && /shows “(.*?)” under the earlier cut and “(.*?)” under the current one/.exec(n.text);
  const f = x.cell.key === 'returns' ? 'returns' : 'groups';
  lines.push([x.id, x.expected.kind, x.mainRow, o.row, n ? `${n.tone}: ${n.title} [${n.actions.join('/')}]` : 'none', w ? `${w[1]} -> ${w[2]}` : '', (o.editorLabel || []).join(' ').replace(/\s+/g, ' '), o.sent ? JSON.stringify({ [f]: o.sent[f], ...(o.sent.voices ? { voices: true } : {}) }) : JSON.stringify(o.decl), o.chatCalls, (o.reviewToasts || []).filter((t) => /Nothing was sent/.test(t)).join(' ').slice(0, 220), (o.bootToasts || []).join(' ').slice(0, 260)].join('\t'));
}
require('fs').writeFileSync(process.argv[3] || 'matrix.tsv', lines.join('\n') + '\n');
