# LiveLens Demo Script

## 4-minute happy path

1. Open the landing page and say: "LiveLens helps with confusing online workflows."
2. Click `Start live session`.
3. Upload a screenshot of a job or school application page.
4. Point out that the agent immediately produces a grounded screen summary and checklist.
5. Click the mic button and say: "Help me finish this application."
6. Let the browser speak the reply and highlight the live status orb changing between listening, thinking, and speaking.
7. Interrupt with: "Wait, should I answer yes here?"
8. Explain that the agent uses the current screenshot summary and keeps answers short for voice.
9. Switch from `Assist` to `Act`.
10. Ask: "Can you click the next button?"
11. Show the confirmation card and approve the safe action.
12. Highlight the action log update.
13. Click `Finalize summary`.
14. End by showing the concise completed steps, remaining tasks, and blockers.

## Judge callouts

- Screenshot-first architecture was chosen for demo stability.
- Gemini powers multimodal screen understanding and concise spoken guidance.
- Firestore and Cloud Storage are built into the persistence layer for Google Cloud deployment.
- Playwright is integrated behind a safety gate so actions require confirmation.

