import assert from 'node:assert/strict';

// A safe-point stop is unfinished work, not a question or a killed call.
// Resume without repeating the answer. Leave all terminal assertions to callers.
//
// The verdict is the LAST content block. A question or a finish is the song
// and then the verdict (two blocks); a safe-point stop or a kill is the
// verdict alone (one block; measured 2026-10-08 on the 24-line seed-1 walk at
// a 120 s budget). ~~`content[1]`~~ read only the two-block shape, so the
// first real stop failed here (CI run 37725585352, `mcp/test.mjs` lyric family).
const rowOf = (response) => JSON.parse(response.content[response.content.length - 1].text);

export async function resumeStopped(client, response, options) {
  assert.ok(!response.isError, JSON.stringify(response));
  assert.ok(response.content?.length, JSON.stringify(response));
  let row = rowOf(response);
  while (row.exit_code === 5) {
    assert.ok(!response.isError, 'a safe-point stop is a successful checkpoint');
    assert.ok(row.run_id && row.state, 'a stopped call preserves its run and state');
    const previous = row;
    response = await client.callTool(
      {
        name: 'lyric_revise',
        arguments: { run_id: row.run_id, run_revision: row.run_revision },
      },
      undefined,
      options
    );
    assert.ok(!response.isError, 'continuing a saved safe point succeeds');
    row = rowOf(response);
    assert.equal(row.run_id, previous.run_id, 'continuation stays in the saved run');
    assert.ok(row.run_revision > previous.run_revision, 'continuation advances the revision');
    assert.notEqual(row.exit_code, -1, 'a continuation must not be killed');
  }
  return response;
}
