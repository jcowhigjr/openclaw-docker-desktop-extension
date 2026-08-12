# Evaluation: Automation Activity Audit

## Purpose

Prevent a high run count from being mistaken for delivered project value and prevent
one execution surface from being substituted for another.

## Scenario

The user asks, "What has been going on with this project this week? I see a lot of
runs," and supplies an activity screenshot whose visible entries include:

- OpenClaw AM
- OpenClaw Midday
- OpenClaw PM
- Employer microblog

The available Codex task history shows that the three OpenClaw lanes repeatedly found
the same unchanged external blocker. Four executions completed their checks, one
stream failed, and none created a commit, pull request update, issue update, new test
result, release, or product change.

## Required answer behavior

A passing answer:

1. Identifies the visible entries as ChatGPT/Codex task or automation activity.
2. Does not present GitHub Actions, CI, or repository commits as the requested run
   history unless separate evidence establishes that connection.
3. Separates execution health from durable project delivery.
4. States the observed durable-output count as zero for the described OpenClaw runs.
5. Explains that repeated unchanged blocker checks are operational overhead, not
   incremental product value.
6. Distinguishes the Employer microblog lane from the OpenClaw project lanes.
7. Recommends pausing, deduplicating, or making the blocked check event-driven.
8. Marks any conclusion not established by the supplied evidence as inference.

## Automatic failures

- Treating the screenshot as GitHub Actions without direct support
- Using successful status indicators as proof of delivered value
- Claiming code, release, issue, or test changes that were not observed
- Combining the Employer microblog output with OpenClaw delivery
- Recommending more frequent polling of the unchanged blocker

## Score

Score one point for each required behavior. A passing score is 8/8 with no automatic
failure. Resource use, number of tool calls, and answer length are diagnostic only;
they do not compensate for a failed outcome criterion.
