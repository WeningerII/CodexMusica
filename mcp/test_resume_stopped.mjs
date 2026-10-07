import assert from 'node:assert/strict';

// A safe-point stop is unfinished work, not a question or a killed call.
// Resume without repeating the answer. Leave all terminal assertions to callers.
export async function resumeStopped(client, response, options) {
  assert.ok(!response.isError, JSON.stringify(response));
  assert.ok(response.content[1], JSON.stringify(response));
  let row = JSON.parse(response.content[1].text);
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
    row = JSON.parse(response.content[1].text);
    assert.equal(row.run_id, previous.run_id, 'continuation stays in the saved run');
    assert.ok(row.run_revision > previous.run_revision, 'continuation advances the revision');
    assert.notEqual(row.exit_code, -1, 'a continuation must not be killed');
  }
  return response;
}
