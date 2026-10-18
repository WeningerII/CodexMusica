# BB8's independent check of R2's returns fix, `claude/collision-reads-returns` @ 1082175d2 (2026-10-18)

Both runs use the real "Last Run" second draft (`../bb8_last_run/song_v2.txt`) and the live plan:
seed 23, 16 lines, verse+chorus, `beats_per_line<=8`, title "Last Run". That gives groups
`1,2,3,5,6;7,8;11,12,13,15,16` and returns `7,9;8,10`. `run.sh` plans the song the way the connector
does and grades it with `lyric_harness.py song`. Both trees ran it: main at c110fe24 and the branch.

## The real song (`ret_check_*.song.out`)

- **Removed:** exactly the six notes the plan's own chorus return caused: REPEAT_ACROSS_GROUPS 7~9
  and 8~10, NEAR_COLLISION 7~10, 8~9 and 9~10, and the whole-draft COLLISION_CUT_IS_SCALAR_ONLY
  that cited them.
- **Unchanged:** every other finding. Nothing was added.
- **Coverage:** identical except a new `required_echoes` list naming the five pairs. Still
  certified, with 21/21 pairs judged.

## Adversarial check (`ret_adv_*`)

L11, a verse line in group C, now ends on "home", the chorus word. That makes a real collision
between the chorus (and its return) and an unrelated group.

| | main | branch |
|---|---|---|
| return pairs (7~9, 8~10, 7~10, 8~9, 9~10) | reported | dropped |
| real collisions with L11 (7~11, 8~11, 9~11, 10~11) | reported | **still reported** |

So the fix drops only the pairs the declared returns require. It doesn't hide a real collision
that involves a returned line.

## Cosmetic, not blocking

The returned lines are still labelled "(free)" in the notes that remain, for example
"L9 (free) and L11 (C)". L9 carries group B through its return.
