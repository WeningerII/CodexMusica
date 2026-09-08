import sys
from quality.shard import run_sections
if sys.argv[1] == 'loop':
 import quality.test_loop as t
 names=['test_a_stuck_line_is_asked_again_once_the_draft_has_moved','test_the_batch_door_and_the_recorded_verdict']
else:
 import quality.test_verbs as t
 names=['test_the_loop_suspends_instead_of_guessing','test_finish_is_the_one_door_from_draft_to_rendered_song','test_the_loop_verbs_exit_on_what_stands_at_the_stop','test_the_pasted_song_has_the_same_door_as_a_planned_one','test_the_batch_door_asks_independent_lines_together','test_the_group_verdict_is_on_the_state_and_quoted_next_round']
print('EXACT_SELECTED_SECTIONS',repr(names),flush=True)
code=run_sections(tuple(getattr(t,n) for n in names),'INT31_SELECTED_SHARD',t.FAILURES,footer='All selected INT31 dependency sections completed')
print('SELECTED_SECTIONS_COMPLETED',len(names),'EXIT',code,flush=True)
raise SystemExit(code)
