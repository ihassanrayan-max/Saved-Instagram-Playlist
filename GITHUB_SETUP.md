# Git workflow

This downloaded project is now connected to its original history at:
https://github.com/ihassanrayan-max/insta-saved-playlist

## Checkpoints

Group roughly two related functional edits into a logical commit once their relevant tests pass. Keep the working tree reviewable. Use specific messages describing the behavior changed; avoid empty commits or artificial timestamp changes. Larger independent changes can have separate commits when that makes review easier.

Before pushing, run the automated suite, lint, TypeScript/build checks, and the relevant browser regression checks. Inspect `git diff --check` and `git status` so generated builds, secrets, and fixture bundles are not included.

```sh
npm test
npm run lint
npm run build
git diff --check
git log --oneline origin/main..HEAD
git push origin main
```

GitHub CLI authentication was expired when this checkout was connected. If pushing fails, sign in with `gh auth login --hostname github.com` and then run `gh auth setup-git`. Do not overwrite remote history or use a force push to work around authentication failures.

Commits appear in the contribution graph according to GitHub's rules, including the branch, repository, and author email associated with the account. Keep actual commit dates and confirm the configured author email is linked to the intended GitHub account. Do not promise that a particular commit count produces additional contribution days.
