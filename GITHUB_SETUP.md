# GitHub Repository Setup Instructions

Your code is ready and committed locally! Follow these steps to upload to GitHub:

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `instagram-playlist-extension` (or your preferred name)
3. Description: "Chrome extension to turn Instagram saved collections into playlists"
4. Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Connect and Push

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/instagram-playlist-extension.git

# Push to GitHub
git push -u origin main
```

## Step 3: Update Git User Info (Optional)

If you want to update the commit author information:

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

Then amend the commit:
```bash
git commit --amend --reset-author --no-edit
git push -f origin main
```

## Step 4: Add Repository Topics (Optional)

On your GitHub repository page:
1. Click the gear icon (⚙️) next to "About"
2. Add topics: `chrome-extension`, `instagram`, `playlist`, `react`, `typescript`, `vite`

## Done! 🎉

Your repository is now live on GitHub!

