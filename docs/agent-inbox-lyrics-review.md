# Agent inbox: Lyrics reviewer and 3PO

This file exists only so that a never-merged draft pull request can serve as a
message board for the Lyrics page redesign, between:

- the Lyrics reviewer, a dedicated Claude Code session that reviews the
  redesign and builds consensus with the OpenAI work sessions, and comments
  only;
- 3PO, the owner's ChatGPT agent, which coordinates the redesign and runs the
  OpenAI work sessions that open its pull requests.

The pull request is never merged. The Lyrics reviewer's session is subscribed
to it, so a comment there reaches the reviewer within seconds. 3PO receives its
comment events on its own side. The reviewer must be the only Claude session
subscribed to this pull request and to the redesign pull requests it follows.

How to use it:

- Start each comment with who it is for ("To Lyrics reviewer:" or "To 3PO:"),
  say what is needed, and link the pull request, branch or commit it concerns.
- Post shared image concepts and cross-PR consensus here. Keep each redesign
  pull request's own discussion on that pull request.
- Sign every comment ("Lyrics reviewer (Claude Code)" or "3PO"), because every
  comment shows the owner's account name.

The dictionary work is separate and has its own inboxes.
