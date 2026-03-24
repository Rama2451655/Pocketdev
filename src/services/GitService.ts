// src/services/GitService.ts
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

// Polyfill for React Native environment
const fs = new LightningFS('pocketdev-fs');

export interface GitConfig {
  name: string;
  email: string;
  token?: string; // GitHub/GitLab personal access token
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  parents: string[];
}

class GitService {
  private dir: string = '';
  private config: GitConfig = { name: '', email: '' };

  setDirectory(dir: string) {
    this.dir = dir;
  }

  setConfig(config: GitConfig) {
    this.config = config;
  }

  // ---- INIT ----
  async init(): Promise<void> {
    await git.init({ fs, dir: this.dir });
    await this.setGitConfig();
  }

  async setGitConfig(): Promise<void> {
    if (this.config.name) {
      await git.setConfig({ fs, dir: this.dir, path: 'user.name', value: this.config.name });
    }
    if (this.config.email) {
      await git.setConfig({ fs, dir: this.dir, path: 'user.email', value: this.config.email });
    }
  }

  // ---- CLONE ----
  async clone(
    url: string,
    destinationDir: string,
    onProgress?: (event: { phase: string; loaded?: number; total?: number }) => void
  ): Promise<void> {
    const onAuth = () => ({
      username: this.config.token ? 'token' : undefined,
      password: this.config.token,
    });

    await git.clone({
      fs,
      http,
      dir: destinationDir,
      url,
      depth: 50,
      singleBranch: true,
      onProgress,
      onAuth,
      corsProxy: 'https://cors.isomorphic-git.org',
    });
  }

  // ---- STATUS ----
  async status(): Promise<{ staged: any[]; unstaged: any[] }> {
    const matrix = await git.statusMatrix({ fs, dir: this.dir });

    const staged: any[] = [];
    const unstaged: any[] = [];

    for (const [filepath, HEADstatus, workdirStatus, stageStatus] of matrix) {
      const isModifiedInWorkdir = workdirStatus !== stageStatus;
      const isModifiedInStage = stageStatus !== HEADstatus;

      if (isModifiedInWorkdir) {
        let status = 'modified';
        if (HEADstatus === 0) status = 'untracked';
        if (workdirStatus === 0) status = 'deleted';

        unstaged.push({ path: filepath, status, staged: false });
      }

      if (isModifiedInStage) {
        let status = 'modified';
        if (HEADstatus === 0 && stageStatus !== 0) status = 'added';
        if (stageStatus === 0) status = 'deleted';

        staged.push({ path: filepath, status, staged: true });
      }
    }

    return { staged, unstaged };
  }

  // ---- ADD (STAGE) ----
  async add(filepath: string): Promise<void> {
    await git.add({ fs, dir: this.dir, filepath });
  }

  async addAll(): Promise<void> {
    await git.add({ fs, dir: this.dir, filepath: '.' });
  }

  async unstage(filepath: string): Promise<void> {
    await git.resetIndex({ fs, dir: this.dir, filepath });
  }

  // ---- COMMIT ----
  async commit(message: string): Promise<string> {
    const hash = await git.commit({
      fs,
      dir: this.dir,
      message,
      author: {
        name: this.config.name || 'PocketDev User',
        email: this.config.email || 'user@pocketdev.io',
      },
    });
    return hash;
  }

  // ---- PUSH ----
  async push(tokenOrRemote: string = 'origin', branch?: string): Promise<void> {
    // Accept either a token (starts with gh_, glpat-, etc.) or a remote name
    const isToken = tokenOrRemote.length > 20 && !tokenOrRemote.includes('/');
    const remote = isToken ? 'origin' : tokenOrRemote;
    const token = isToken ? tokenOrRemote : this.config.token;
    const currentBranch = branch || await git.currentBranch({ fs, dir: this.dir }) || 'main';

    await git.push({
      fs,
      http,
      dir: this.dir,
      remote,
      remoteRef: currentBranch,
      onAuth: () => ({
        username: token ? 'token' : 'git',
        password: token,
      }),
      onAuthFailure: () => {
        throw new Error('Authentication failed. Check your access token in Settings.');
      },
    });
  }

  // ---- PULL ----
  async pull(remote: string = 'origin'): Promise<void> {
    await git.pull({
      fs,
      http,
      dir: this.dir,
      remote,
      author: {
        name: this.config.name || 'PocketDev User',
        email: this.config.email || 'user@pocketdev.io',
      },
      onAuth: () => ({
        username: 'token',
        password: this.config.token,
      }),
    });
  }

  // ---- FETCH ----
  async fetch(remote: string = 'origin'): Promise<void> {
    await git.fetch({
      fs,
      http,
      dir: this.dir,
      remote,
      onAuth: () => ({
        username: 'token',
        password: this.config.token,
      }),
    });
  }

  // ---- BRANCHES ----
  async getBranches(): Promise<Array<{ name: string; isCurrent: boolean; isRemote: boolean }>> {
    const current = await this.getCurrentBranch();
    const local = await git.listBranches({ fs, dir: this.dir });
    let remoteNames: string[] = [];
    try {
      remoteNames = await git.listBranches({ fs, dir: this.dir, remote: 'origin' });
    } catch {}
    const localBranches = local.map(name => ({
      name,
      isCurrent: name === current,
      isRemote: false,
    }));
    const remoteBranches = remoteNames
      .filter(name => !local.includes(name))
      .map(name => ({ name: `origin/${name}`, isCurrent: false, isRemote: true }));
    return [...localBranches, ...remoteBranches];
  }

  async getCurrentBranch(): Promise<string> {
    return (await git.currentBranch({ fs, dir: this.dir })) || 'HEAD';
  }

  async createBranch(name: string, checkout: boolean = true): Promise<void> {
    await git.branch({ fs, dir: this.dir, ref: name });
    if (checkout) {
      await git.checkout({ fs, dir: this.dir, ref: name });
    }
  }

  async checkout(ref: string): Promise<void> {
    await git.checkout({ fs, dir: this.dir, ref });
  }

  async deleteBranch(name: string): Promise<void> {
    await git.deleteBranch({ fs, dir: this.dir, ref: name });
  }

  // ---- LOG ----
  async log(depth: number = 20): Promise<CommitInfo[]> {
    const commits = await git.log({ fs, dir: this.dir, depth });
    return commits.map(c => ({
      hash: c.oid,
      shortHash: c.oid.slice(0, 7),
      message: c.commit.message,
      author: c.commit.author.name,
      email: c.commit.author.email,
      date: new Date(c.commit.author.timestamp * 1000),
      parents: c.commit.parent,
    }));
  }

  // ---- DIFF ----
  async diff(filepath?: string): Promise<string> {
    // Get the commit tree
    try {
      const commits = await git.log({ fs, dir: this.dir, depth: 2 });
      if (commits.length < 1) return 'No commits yet';

      // Simple diff implementation
      const currentContent = filepath
        ? await this.readFileContent(filepath)
        : '';

      return `diff --git a/${filepath} b/${filepath}\n--- a/${filepath}\n+++ b/${filepath}\n${currentContent}`;
    } catch {
      return 'Unable to generate diff';
    }
  }

  private async readFileContent(filepath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(`${this.dir}/${filepath}`, { encoding: 'utf8' });
      return content as string;
    } catch {
      return '';
    }
  }

  // ---- REMOTES ----
  async getRemotes(): Promise<{ name: string; url: string }[]> {
    const remotes = await git.listRemotes({ fs, dir: this.dir });
    return remotes;
  }

  async addRemote(name: string, url: string): Promise<void> {
    await git.addRemote({ fs, dir: this.dir, remote: name, url });
  }

  // ---- STASH (Manual implementation) ----
  async stash(): Promise<void> {
    // Save working directory changes
    const status = await this.status();
    const stashContent = JSON.stringify({
      timestamp: Date.now(),
      files: await Promise.all(
        status.unstaged.map(async (f) => ({
          path: f.path,
          content: await this.readFileContent(f.path),
        }))
      ),
    });

    await fs.promises.writeFile(
      `${this.dir}/.git/stash_${Date.now()}`,
      stashContent
    );

    // Reset to HEAD
    await git.checkout({ fs, dir: this.dir, force: true });
  }

  // ---- MERGE / REBASE ----
  async merge(branch: string): Promise<void> {
    await git.merge({
      fs,
      dir: this.dir,
      ours: await this.getCurrentBranch(),
      theirs: branch,
      author: {
        name: this.config.name,
        email: this.config.email,
      },
    });
  }

  // ---- UTILITY ----
  async isGitRepo(): Promise<boolean> {
    try {
      await git.currentBranch({ fs, dir: this.dir });
      return true;
    } catch {
      return false;
    }
  }

  async getRepoInfo(): Promise<{
    url: string | null;
    branch: string;
    lastCommit: CommitInfo | null;
  }> {
    const branch = await this.getCurrentBranch();
    const remotes = await this.getRemotes();
    const log = await this.log(1);

    return {
      url: remotes[0]?.url || null,
      branch,
      lastCommit: log[0] || null,
    };
  }
}

export default new GitService();
