import { describe, it, expect } from 'vitest';
import { resolveRepoRef } from '../repoRef';

describe('resolveRepoRef', () => {
  it('separa owner/repo cuando hay barra', () => {
    expect(resolveRepoRef('migueljerico/github-ai-assistant', 'otro'))
      .toEqual({ owner: 'migueljerico', repo: 'github-ai-assistant' });
  });

  it('usa defaultOwner cuando solo se da el repo', () => {
    expect(resolveRepoRef('mi-repo', 'migueljerico'))
      .toEqual({ owner: 'migueljerico', repo: 'mi-repo' });
  });

  it('recorta espacios alrededor', () => {
    expect(resolveRepoRef('  owner/repo  ', 'x'))
      .toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('solo parte por la primera barra', () => {
    expect(resolveRepoRef('owner/repo/extra', 'x'))
      .toEqual({ owner: 'owner', repo: 'repo' });
  });
});
