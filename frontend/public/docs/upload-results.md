# Upload results from an EventLink PDF

The fastest way to get a draft night onto the ladder is to upload the **“Standings by Rank”**
PDF that EventLink produces for each pod.

## 1. Export the PDF from EventLink

For each pod, in EventLink open the event and print/export the **Standings by Rank** report to
PDF. You’ll get **one PDF per pod** (e.g. `Draft Pod 1`, `Draft Pod 2`).

> The report must be the final, **3-round** standings. The upload rejects anything else.

## 2. Upload it

Go to **Upload → Choose PDF** and pick a pod’s file. We read it and show a preview:

- **Set / season** — defaults to the set whose dates cover the event. Change it if needed.
- **Date, Pod #, Venue, Event name** — filled in from the PDF; the event name is built as
  `Set - DD Mon YYYY - Pod N` and you can edit it.
- **Players** — each row shows the name from the PDF and the matched player.
  - A row marked **＋ new** will create a new player. If it’s really an existing player under a
    different spelling, use the search box to map it — no duplicate is created.
  - **W / L / D** are inferred from each player’s points (e.g. 3 points → 1W-2L). Fix the rare
    ambiguous row here; the record must always add up to 3.

## 3. Commit

Press **Commit to ladder**. The pod becomes an event and points appear immediately.

## Notes

- **Re-uploading is blocked.** Each pod carries its EventLink id, so uploading the same PDF twice
  won’t duplicate it — you’ll get a link to edit the existing event instead.
- **Multiple pods = multiple uploads.** Upload each pod’s PDF separately; each becomes its own
  “… - Pod N” event.
- Every upload is listed under **Uploaded** at the bottom of the page, and in **History**.
